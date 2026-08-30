import express from "express";
import fs from "fs";
import path from "path";
import YAML from "yaml";
import { getLoadedParsers, getParsersDir } from "../modules/parser-manager.js";

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

// GET /api/parsers - list parser definitions currently loaded by the hot-reload registry.
router.get("/", (_req, res) => {
  const parsers = getLoadedParsers().map(toParserSummary);
  return res.json({ count: parsers.length, parsers });
});

// POST /api/parsers - save a validated YAML definition; the existing watcher reloads it.
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

  if (!parser || typeof parser !== "object" || Array.isArray(parser)) {
    return res.status(400).json({ error: "YAML content must define a parser object" });
  }
  if (typeof parser.parser_id !== "string" || !/^[a-zA-Z0-9_.-]+$/.test(parser.parser_id)) {
    return res.status(400).json({ error: "parser_id is required and may contain only letters, numbers, underscores, dots, and hyphens" });
  }
  if (!parser.detection || !Array.isArray(parser.detection.signatures)) {
    return res.status(400).json({ error: "Parser must include detection.signatures as an array" });
  }
  if (!Array.isArray(parser.extraction_rules)) {
    return res.status(400).json({ error: "Parser must include extraction_rules as an array" });
  }

  const parsersDir = getParsersDir();
  fs.mkdirSync(parsersDir, { recursive: true });
  const filePath = path.join(parsersDir, `${parser.parser_id}.yaml`);
  fs.writeFileSync(filePath, yamlContent, "utf-8");

  return res.status(201).json({
    status: "saved",
    parser: toParserSummary(parser),
    file_path: filePath
  });
});

export default router;
