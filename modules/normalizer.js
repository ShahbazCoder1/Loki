import fs from "fs";
import path from "path";
import yaml from "yaml";
import { fileURLToPath } from "url";

import { recordLineage } from "./field-lineage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEVERITY_MAP = {
  1: "critical",
  2: "high",
  3: "high",
  4: "medium",
  5: "low",
  6: "informational",
  7: "debug"
};

const ACTION_MAP = {
  built: "allowed",
  allow: "allowed",
  allowed: "allowed",
  accept: "allowed",
  accepted: "allowed",
  permit: "allowed",
  permitted: "allowed",
  pass: "allowed",
  passed: "allowed",
  deny: "denied",
  denied: "denied",
  block: "denied",
  blocked: "denied",
  reject: "denied",
  rejected: "denied",
  drop: "dropped",
  dropped: "dropped",
  discard: "dropped",
  teardown: "closed",
  close: "closed",
  closed: "closed",
  log: "logged",
  logged: "logged",
  reset: "reset"
};

function loadParserDefinition(parserId) {
  const parserPath = path.join(
    __dirname,
    "..",
    "parsers",
    `${parserId}.yaml`
  );

  const parserFile = fs.readFileSync(parserPath, "utf8");

  return yaml.parse(parserFile);
}

function setNestedValue(object, fieldPath, value) {
  const fields = fieldPath.split(".");
  let current = object;

  for (let i = 0; i < fields.length - 1; i++) {
    const field = fields[i];

    if (!current[field]) {
      current[field] = {};
    }

    current = current[field];
  }

  current[fields[fields.length - 1]] = value;
}

function normalizeTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

function normalizeAction(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return ACTION_MAP[String(value).toLowerCase()] || value;
}

function getNormalizedValue(parsedField, value, normalizedField) {
  // Use the normalized target field name for type detection when available
  const checkField = (normalizedField || parsedField).toLowerCase();

  if (
    checkField.includes("timestamp") ||
    checkField.includes("time")
  ) {
    return normalizeTimestamp(value);
  }

  if (checkField === "action" || checkField.endsWith(".action")) {
    return normalizeAction(value);
  }

  if (
    checkField.includes("port") ||
    checkField === "spt" ||
    checkField === "dpt" ||
    checkField === "srcport" ||
    checkField === "dstport"
  ) {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? value : numericValue;
  }

  return value;
}

export function normalize(eventEnvelope, parseResult, parserId) {
  const parserDefinition = loadParserDefinition(parserId);

  const normalizationMapping =
    parserDefinition.normalization_mapping || {};

  const normalizedFields = {};
  const fieldLineage = {};

  const parsedFields =
    parseResult.parsedFields ||
    parseResult.fields ||
    {};

  const parserVersion =
    parserDefinition.version || "1.0";

  const extractionRules =
    parserDefinition.extraction_rules || [];

  // Required prototype-level fields
  normalizedFields.event_class = "network_activity";
  normalizedFields.timestamp = eventEnvelope.received_at;

  // Apply parser normalization mappings
  for (const [parsedFieldName, normalizedFieldName] of Object.entries(
    normalizationMapping
  )) {
    const value = parsedFields[parsedFieldName];

    if (value === undefined || value === null) {
      continue;
    }

    // Severity needs both numeric severity and human-readable label
    if (parsedFieldName === "severity") {
      const numericSeverity = Number(value);

      normalizedFields.severity = numericSeverity;
      normalizedFields.severity_label =
        SEVERITY_MAP[numericSeverity] || "informational";

      const extractionRule = extractionRules.find(
        (rule) => rule.field === parsedFieldName
      );

      fieldLineage.severity = recordLineage(
        "severity",
        String(value),
        parsedFieldName,
        extractionRule?.regex || null,
        parserId,
        parserVersion,
        `${parsedFieldName} -> severity`
      );

      fieldLineage.severity_label = recordLineage(
        "severity_label",
        String(value),
        parsedFieldName,
        extractionRule?.regex || null,
        parserId,
        parserVersion,
        `${parsedFieldName} -> severity_label`
      );

      continue;
    }

    const normalizedValue = getNormalizedValue(
      parsedFieldName,
      value,
      normalizedFieldName
    );

    setNestedValue(
      normalizedFields,
      normalizedFieldName,
      normalizedValue
    );

    const extractionRule = extractionRules.find(
      (rule) => rule.field === parsedFieldName
    );

    fieldLineage[normalizedFieldName] = recordLineage(
      normalizedFieldName,
      String(value),
      parsedFieldName,
      extractionRule?.regex || null,
      parserId,
      parserVersion,
      `${parsedFieldName} -> ${normalizedFieldName}`
    );
  }

  // Fallback: ensure `action` required field is populated even if not in normalization_mapping
  if (normalizedFields.action === undefined || normalizedFields.action === null) {
    // Try common action field names from parsedFields
    const actionFieldNames = ["action", "act", "disposition"];
    for (const fieldName of actionFieldNames) {
      const rawAction = parsedFields[fieldName];
      if (rawAction !== undefined && rawAction !== null) {
        normalizedFields.action = normalizeAction(rawAction);
        break;
      }
    }
  }

  return {
    normalizedFields,
    fieldLineage
  };
}