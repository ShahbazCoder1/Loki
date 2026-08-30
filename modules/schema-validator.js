import fs from "fs";
import path from "path";
import net from "net";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPath(source, dottedPath) {
  return dottedPath.split(".").reduce(
    (value, segment) => value == null ? undefined : value[segment],
    source
  );
}

function loadSchema(schemaPath) {
  const filePath = schemaPath || path.join(__dirname, "..", "config", "schema.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function isValidType(value, type) {
  switch (type) {
    case "string":
      return typeof value === "string" && value.trim() !== "";
    case "integer":
      return Number.isInteger(value);
    case "ipv4":
      return typeof value === "string" && net.isIPv4(value);
    case "iso8601":
      return typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
        !Number.isNaN(Date.parse(value));
    default:
      return true;
  }
}

/** Validate an OCSF-aligned event against config/schema.json. */
export function validate(normalizedFields, options = {}) {
  const schema = options.schema || loadSchema(options.schemaPath);
  const errors = [];

  if (!normalizedFields || typeof normalizedFields !== "object" || Array.isArray(normalizedFields)) {
    return { valid: false, errors: ["Normalized fields must be an object"] };
  }

  for (const field of schema.required_fields || []) {
    const value = getPath(normalizedFields, field);
    if (value === undefined || value === null || value === "") {
      errors.push(`Missing required field: '${field}'`);
    }
  }

  for (const [field, type] of Object.entries(schema.field_types || {})) {
    const value = getPath(normalizedFields, field);
    if (value !== undefined && value !== null && !isValidType(value, type)) {
      errors.push(`Invalid ${type} value for field '${field}': '${value}'`);
    }
  }

  for (const [field, allowedValues] of Object.entries(schema.enum_values || {})) {
    const value = getPath(normalizedFields, field);
    if (value !== undefined && !allowedValues.includes(value)) {
      errors.push(`Invalid enum value for field '${field}': '${value}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export default validate;
