import express from "express";
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { getLoadedParsers, getParsersDir, loadAllParsers } from "../modules/parser-manager.js";

const router = express.Router();

function toParserSummary(parser) {
  return {
    parser_id: parser.parser_id,
    version: parser.version || "unknown",
    device_family: parser.device_family || "Unknown",
    status: "ACTIVE",
    signatures: parser.detection?.signatures || []
  };
}

function validateParserDefinition(parser) {
  const errors = [];
  if (!parser || typeof parser !== "object" || Array.isArray(parser)) {
    return ["YAML content must define a parser object"];
  }
  if (typeof parser.parser_id !== "string" || !/^[a-zA-Z0-9_.-]+$/.test(parser.parser_id)) {
    errors.push("parser_id is required and may contain only letters, numbers, underscores, dots, and hyphens");
  }
  if (!parser.detection || !Array.isArray(parser.detection.signatures) || parser.detection.signatures.length === 0) {
    errors.push("Parser must include at least one detection signature");
  }
  if (!Array.isArray(parser.extraction_rules) || parser.extraction_rules.length === 0) {
    errors.push("Parser must include at least one extraction rule");
  } else {
    for (const rule of parser.extraction_rules) {
      if (!rule?.field || !rule?.regex) {
        errors.push("Every extraction rule must contain field and regex values");
        break;
      }
      try {
        new RegExp(rule.regex);
      } catch (error) {
        errors.push(`Invalid regex for field '${rule.field}': ${error.message}`);
      }
    }
  }
  if (!parser.normalization_mapping || typeof parser.normalization_mapping !== "object") {
    errors.push("Parser must include normalization_mapping");
  }
  return errors;
}

// GET /api/parsers
router.get("/", (_req, res) => {
  const parsers = getLoadedParsers().map(toParserSummary);
  return res.json({ count: parsers.length, parsers });
});

// POST /api/parsers - accept YAML text and activate it through the hot-reload registry.
router.post("/", (req, res) => {
  const yamlContent = req.body?.yaml_content;
  if (typeof yamlContent !== "string" || !yamlContent.trim()) {
    return res.status(400).json({ error: "Request body must contain a non-empty yaml_content string" });
  }

  let parser;
  try {
    parser = YAML.parse(yamlContent);
  } catch (error) {
    return res.status(400).json({ error: `Invalid YAML: ${error.message}` });
  }

  const validationErrors = validateParserDefinition(parser);
  if (validationErrors.length > 0) {
    return res.status(400).json({ error: "Invalid parser definition", details: validationErrors });
  }

  const parsersDir = getParsersDir();
  fs.mkdirSync(parsersDir, { recursive: true });
  const filePath = path.join(parsersDir, `${parser.parser_id}.yaml`);

  if (fs.existsSync(filePath)) {
    return res.status(409).json({
      error: `Parser '${parser.parser_id}' already exists; use a new versioned parser_id`
    });
  }

  fs.writeFileSync(filePath, yamlContent, "utf-8");
  loadAllParsers(parsersDir);

  return res.status(201).json({
    status: "saved",
    parser: toParserSummary(parser),
    file_path: filePath
  });
});

export { validateParserDefinition };
export default router;
