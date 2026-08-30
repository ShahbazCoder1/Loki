import express from "express";
import fs from "fs";
import path from "path";
import YAML from "yaml";

import {
  getParsersDir,
  loadAllParsers
} from "../modules/parser-manager.js";

const MAX_UPLOAD_BYTES = 1024 * 1024;

function parserSummary(parser) {
  return {
    parser_id: parser.parser_id,
    version: parser.version || "unknown",
    device_family: parser.device_family || "unknown",
    status: "loaded",
    signatures: parser.detection?.signatures || []
  };
}

function multipartYaml(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return null;

  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
  const parts = buffer.toString("utf8").split(boundary);

  for (const part of parts) {
    const separator = part.indexOf("\r\n\r\n");
    if (separator === -1) continue;

    const headers = part.slice(0, separator);
    if (!/name="(?:file|yaml_content)"/i.test(headers)) continue;

    return part
      .slice(separator + 4)
      .replace(/\r\n--$/, "")
      .replace(/\r\n$/, "");
  }

  return null;
}

function readYamlContent(req) {
  if (Buffer.isBuffer(req.body)) {
    return multipartYaml(req.body, req.get("content-type") || "");
  }

  if (typeof req.body?.yaml_content === "string") {
    return req.body.yaml_content;
  }

  return null;
}

function validateParserDefinition(parser) {
  const errors = [];

  if (!parser || typeof parser !== "object" || Array.isArray(parser)) {
    return ["YAML must contain a parser object"];
  }

  if (!parser.parser_id || typeof parser.parser_id !== "string") {
    errors.push("parser_id is required");
  } else if (!/^[A-Za-z0-9._-]+$/.test(parser.parser_id)) {
    errors.push("parser_id may contain only letters, numbers, dots, underscores, and hyphens");
  }

  if (!parser.version) errors.push("version is required");
  if (!parser.device_family) errors.push("device_family is required");
  if (!Array.isArray(parser.detection?.signatures) || parser.detection.signatures.length === 0) {
    errors.push("detection.signatures must be a non-empty array");
  }
  if (!Array.isArray(parser.extraction_rules) || parser.extraction_rules.length === 0) {
    errors.push("extraction_rules must be a non-empty array");
  }

  return errors;
}

export function createParsersRouter({ parsersDir } = {}) {
  const router = express.Router();

  router.get("/", (_req, res) => {
    const parsers = loadAllParsers(parsersDir).map(parserSummary);
    res.json(parsers);
  });

  router.post(
    "/",
    express.raw({ type: "multipart/form-data", limit: MAX_UPLOAD_BYTES }),
    (req, res) => {
      const yamlContent = readYamlContent(req);
      if (!yamlContent || !yamlContent.trim()) {
        return res.status(400).json({
          error: "yaml_content is required as JSON or a multipart file upload"
        });
      }

      let parser;
      try {
        parser = YAML.parse(yamlContent);
      } catch (error) {
        return res.status(400).json({
          error: "Invalid YAML parser file",
          details: [error.message]
        });
      }

      const errors = validateParserDefinition(parser);
      if (errors.length > 0) {
        return res.status(422).json({
          error: "Invalid parser definition",
          details: errors
        });
      }

      const targetDir = getParsersDir(parsersDir);
      fs.mkdirSync(targetDir, { recursive: true });
      const fileName = `${parser.parser_id}.yaml`;
      const filePath = path.join(targetDir, fileName);

      fs.writeFileSync(filePath, yamlContent.endsWith("\n") ? yamlContent : `${yamlContent}\n`, {
        encoding: "utf8",
        flag: "wx"
      });

      loadAllParsers(targetDir);

      return res.status(201).json({
        message: "Parser uploaded and loaded",
        parser: parserSummary(parser),
        file: fileName
      });
    }
  );

  router.use((error, _req, res, next) => {
    if (error?.code === "EEXIST") {
      return res.status(409).json({ error: "A parser with this parser_id already exists" });
    }
    if (error?.type === "entity.too.large") {
      return res.status(413).json({ error: "Parser upload exceeds the 1 MB limit" });
    }
    return next(error);
  });

  return router;
}

const router = createParsersRouter();

export { parserSummary, readYamlContent, validateParserDefinition };
export default router;
