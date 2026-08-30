import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadSchema() {
  const schemaPath = path.join(
    __dirname,
    "..",
    "config",
    "schema.json"
  );

  return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
}

function getNestedValue(object, fieldPath) {
  return fieldPath
    .split(".")
    .reduce((current, field) => current?.[field], object);
}

function isValidISO8601(value) {
  if (typeof value !== "string") {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
}

function isValidIPv4(value) {
  if (typeof value !== "string") {
    return false;
  }

  const parts = value.split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false;
    }

    const number = Number(part);

    return number >= 0 && number <= 255;
  });
}

function isCorrectType(value, expectedType) {
  switch (expectedType) {
    case "string":
      return typeof value === "string";

    case "integer":
      return Number.isInteger(value);

    case "number":
      return typeof value === "number" && !Number.isNaN(value);

    case "boolean":
      return typeof value === "boolean";

    case "iso8601":
      return isValidISO8601(value);

    case "ipv4":
      return isValidIPv4(value);

    default:
      return true;
  }
}

export function validate(normalizedFields) {
  const schema = loadSchema();
  const errors = [];

  // 1. Check required fields
  for (const field of schema.required_fields) {
    const value = getNestedValue(normalizedFields, field);

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      errors.push(`missing field: ${field}`);
    }
  }

  // 2. Check field types
  for (const [field, expectedType] of Object.entries(
    schema.field_types
  )) {
    const value = getNestedValue(normalizedFields, field);

    // Optional fields don't need validation if absent
    if (value === undefined || value === null) {
      continue;
    }

    if (!isCorrectType(value, expectedType)) {
      errors.push(
        `invalid type for field: ${field}, expected ${expectedType}`
      );
    }
  }

  // 3. Check enum values
  for (const [field, allowedValues] of Object.entries(
    schema.enum_values
  )) {
    const value = getNestedValue(normalizedFields, field);

    if (value === undefined || value === null) {
      continue;
    }

    if (!allowedValues.includes(value)) {
      errors.push(
        `invalid value for field: ${field}: ${value}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}