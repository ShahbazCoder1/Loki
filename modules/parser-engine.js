import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Locate and load a parser definition by parser ID
 * 
 * @param {string} parserId - The parser ID (e.g. "cisco_asa_v1.0")
 * @param {string} [parsersDir] - Optional custom parsers directory
 * @returns {Object|null} The parsed YAML object or null if not found
 */
export function loadParserDefinition(parserId, parsersDir) {
  if (!parserId || typeof parserId !== "string") return null;

  const candidateDirs = parsersDir
    ? [parsersDir]
    : [
        path.join(process.cwd(), "parsers"),
        path.join(__dirname, "../parsers"),
        path.join(__dirname, "../../parsers"),
        path.join(process.cwd(), "ulpf-prototype/parsers")
      ];

  let targetDir = null;
  for (const d of candidateDirs) {
    if (d && fs.existsSync(d) && fs.statSync(d).isDirectory()) {
      targetDir = d;
      break;
    }
  }

  if (!targetDir) return null;

  // 1. Try direct filename matches
  const extensions = ["", ".yaml", ".yml"];
  for (const ext of extensions) {
    const filename = parserId.endsWith(".yaml") || parserId.endsWith(".yml") ? parserId : `${parserId}${ext}`;
    const fullPath = path.join(targetDir, filename);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const parsed = YAML.parse(content);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch (_) {}
    }
  }

  // 2. Try searching directory for matching parser_id property
  try {
    const files = fs.readdirSync(targetDir);
    for (const file of files) {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        const fullPath = path.join(targetDir, file);
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const parsed = YAML.parse(content);
          if (parsed && (parsed.parser_id === parserId || path.basename(file, path.extname(file)) === parserId)) {
            return parsed;
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Validates IPv4 address string
 * @param {string} ip - IP address string
 * @returns {boolean}
 */
export function isValidIPv4(ip) {
  if (typeof ip !== "string") return false;
  return net.isIPv4(ip);
}

/**
 * Validates IPv4 or IPv6 address string using net.isIP()
 * @param {string} ip - IP address string
 * @returns {boolean}
 */
export function isValidIP(ip) {
  if (typeof ip !== "string" || !ip.trim()) return false;
  const cleaned = ip.trim().replace(/^\[|\]$/g, "");
  const version = net.isIP(cleaned);
  return version === 4 || version === 6;
}

/**
 * Validates if a string or number represents a parseable timestamp or date
 * @param {string|number} val - Timestamp or date value
 * @returns {boolean}
 */
export function isValidTimestamp(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === "number") return val > 0;
  if (typeof val !== "string" || !val.trim()) return false;
  const str = val.trim();

  // 1. Numeric epoch (seconds or milliseconds)
  if (/^\d{10,13}$/.test(str)) {
    const num = Number(str);
    return !isNaN(num) && num > 0;
  }

  // 2. Standard ISO 8601 or Date parseable formats (e.g. 2026-08-25T10:00:00Z, Aug 25 10:00:00)
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return true;

  // 3. Time-only format HH:MM:SS or Date-only format YYYY-MM-DD
  if (/^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true;

  return false;
}

/**
 * Executes regex extraction rules against raw log text
 * 
 * @param {string} rawLog - Raw log string
 * @param {Array<Object>} extractionRules - Extraction rules array from YAML
 * @returns {Object} Extracted fields map
 */
export function extractFields(rawLog, extractionRules) {
  const extracted = {};
  if (!rawLog || !Array.isArray(extractionRules)) return extracted;

  for (const rule of extractionRules) {
    if (!rule || !rule.field || !rule.regex) continue;
    try {
      const regex = new RegExp(rule.regex);
      const match = rawLog.match(regex);
      if (match) {
        if (match[1] !== undefined) {
          extracted[rule.field] = match[1].trim();
        } else if (match[0] !== undefined) {
          extracted[rule.field] = match[0].trim();
        }
      }
    } catch (_) {}
  }

  return extracted;
}

/**
 * Main parse function for Parser Engine (Task 2)
 * 
 * @param {Object|string} eventEnvelope - Event envelope object containing raw.immutable_payload or raw log string
 * @param {string} parserId - ID of the parser to use (e.g. "cisco_asa_v1.0")
 * @param {Object} [options] - Optional override options (parserDefinition, parsersDir)
 * @returns {{ parsedFields: Object, validationStatus: string, errors: Array<string>, parserVersion: string }}
 */
export function parse(eventEnvelope, parserId, options = {}) {
  // Extract raw log string
  let rawLog = "";
  if (typeof eventEnvelope === "string") {
    rawLog = eventEnvelope;
  } else if (eventEnvelope && eventEnvelope.raw && typeof eventEnvelope.raw.immutable_payload === "string") {
    rawLog = eventEnvelope.raw.immutable_payload;
  } else if (eventEnvelope && eventEnvelope.raw && typeof eventEnvelope.raw.payload === "string") {
    rawLog = eventEnvelope.raw.payload;
  }

  const errors = [];
  const parsedFields = {};

  if (!rawLog) {
    return {
      parsedFields: {},
      validationStatus: "FAIL",
      errors: ["Raw log string is empty or invalid"],
      parserVersion: "unknown"
    };
  }

  // Load parser definition
  const parser = options.parserDefinition || loadParserDefinition(parserId, options.parsersDir);

  if (!parser) {
    return {
      parsedFields: {},
      validationStatus: "FAIL",
      errors: [`Parser definition not found for parserId '${parserId}'`],
      parserVersion: "unknown"
    };
  }

  const parserVersion = parser.version || "1.0";
  const extractionRules = parser.extraction_rules || [];
  const requiredFields = parser.required_fields || [];

  // Extract fields
  const fields = extractFields(rawLog, extractionRules);
  Object.assign(parsedFields, fields);

  const extractedKeyCount = Object.keys(parsedFields).length;

  if (extractedKeyCount === 0) {
    return {
      parsedFields: {},
      validationStatus: "FAIL",
      errors: ["Zero fields extracted using parser rules"],
      parserVersion
    };
  }

  // Validate required fields
  let missingRequired = false;
  for (const reqField of requiredFields) {
    if (!parsedFields[reqField] || String(parsedFields[reqField]).trim() === "") {
      errors.push(`Missing required field: '${reqField}'`);
      missingRequired = true;
    }
  }

  // Validate IP address format (both IPv4 and IPv6) for IP fields
  const ipFieldNames = ["src_ip", "dst_ip", "srcip", "dstip", "src", "dst"];
  for (const [key, val] of Object.entries(parsedFields)) {
    if (ipFieldNames.includes(key) || key.toLowerCase().endsWith("_ip") || key.toLowerCase().endsWith("ip")) {
      if (val && typeof val === "string" && !isValidIP(val)) {
        errors.push(`Invalid IP address format for field '${key}': '${val}'`);
      }
    }
  }

  // Validate timestamp / date fields parseability
  const timestampFields = ["timestamp", "time", "date", "event_time", "event_timestamp", "datetime"];
  for (const [key, val] of Object.entries(parsedFields)) {
    if (timestampFields.includes(key) || key.toLowerCase().includes("time") || key.toLowerCase().includes("date")) {
      if (val !== undefined && val !== null && !isValidTimestamp(val)) {
        errors.push(`Invalid timestamp format for field '${key}': '${val}'`);
      }
    }
  }

  // Determine validationStatus
  let validationStatus = "PASS";
  if (missingRequired) {
    validationStatus = "FAIL";
  } else if (errors.length > 0) {
    validationStatus = "PARTIAL";
  } else {
    validationStatus = "PASS";
  }

  return {
    parsedFields,
    validationStatus,
    errors,
    parserVersion
  };
}

export default parse;

