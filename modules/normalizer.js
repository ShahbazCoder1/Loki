import { getParser } from "./parser-manager.js";
import { recordLineage } from "./field-lineage.js";

const ACTION_MAP = {
  built: "allowed",
  allow: "allowed",
  allowed: "allowed",
  accept: "allowed",
  accepted: "allowed",
  permitted: "allowed",
  permit: "allowed",
  deny: "denied",
  denied: "denied",
  block: "denied",
  blocked: "denied",
  drop: "dropped",
  dropped: "dropped",
  teardown: "closed",
  close: "closed",
  closed: "closed",
  reset: "reset",
  log: "logged",
  logged: "logged"
};

const ASA_SEVERITY_LABELS = {
  1: "critical",
  2: "high",
  3: "high",
  4: "medium",
  5: "low",
  6: "informational",
  7: "debug"
};

function setPath(target, dottedPath, value) {
  const segments = dottedPath.split(".");
  let current = target;

  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index];
    if (!current[segment] || typeof current[segment] !== "object") {
      current[segment] = {};
    }
    current = current[segment];
  }

  current[segments.at(-1)] = value;
}

function findRule(parser, field) {
  return (parser.extraction_rules || []).find(rule => rule.field === field) || null;
}

function findRawFragment(rawLog, rule, value) {
  if (!rawLog || !rule?.regex) return value == null ? null : String(value);

  try {
    const match = rawLog.match(new RegExp(rule.regex));
    return match?.[0] ?? String(value);
  } catch (_) {
    return String(value);
  }
}

function normalizeAction(value) {
  if (typeof value !== "string") return value;
  return ACTION_MAP[value.trim().toLowerCase()] || value.trim().toLowerCase();
}

function normalizeEventClass(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["traffic", "network", "network_activity"].includes(normalized)) return "network_activity";
  if (["security", "threat", "security_finding"].includes(normalized)) return "security_finding";
  if (["system", "system_activity"].includes(normalized)) return "system_activity";
  return "network_activity";
}

function toIsoTimestamp(value, fallback) {
  if (value) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date(fallback || Date.now()).toISOString();
}

function normalizeSeverity(value, parserId) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const severity = Math.max(0, Math.min(10, Math.round(numeric)));
    const severityLabel = parserId.startsWith("cisco_asa")
      ? ASA_SEVERITY_LABELS[numeric] || "informational"
      : severity >= 8 ? "critical" : severity >= 6 ? "high" : severity >= 4 ? "medium" : severity >= 1 ? "low" : "informational";
    return { severity, severityLabel };
  }

  const severityLabel = String(value || "informational").trim().toLowerCase();
  return { severity: undefined, severityLabel };
}

/**
 * Map parser output to a nested OCSF-aligned object and retain field lineage.
 * `options.parserDefinition` keeps this module straightforward to unit test and
 * lets callers reuse a parser definition already selected by the pipeline.
 */
export function normalize(eventEnvelope, parseResult, parserId, options = {}) {
  const parser = options.parserDefinition || getParser(parserId);
  if (!parser) {
    throw new Error(`Parser definition not found for parserId '${parserId}'`);
  }

  const parsedFields = parseResult?.parsedFields || parseResult?.fields || {};
  const rawLog = eventEnvelope?.raw?.immutable_payload || "";
  const normalizedFields = {};
  const fieldLineage = {};
  const parserVersion = parseResult?.parserVersion || parser.version || "unknown";
  const mappings = parser.normalization_mapping || {};

  for (const [parsedField, targetPath] of Object.entries(mappings)) {
    const value = parsedFields[parsedField];
    if (value === undefined || value === null || value === "") continue;

    let normalizedValue = value;
    if (targetPath === "action") normalizedValue = normalizeAction(value);
    if (targetPath === "event_class") normalizedValue = normalizeEventClass(value);

    setPath(normalizedFields, targetPath, normalizedValue);
    const rule = findRule(parser, parsedField);
    fieldLineage[targetPath] = recordLineage(
      targetPath,
      findRawFragment(rawLog, rule, value),
      parsedField,
      rule?.regex || null,
      parserId,
      parserVersion,
      `${parsedField} -> ${targetPath}`
    );
  }

  // These common fields are required by the prototype schema even when a
  // source parser does not explicitly map them.
  if (!normalizedFields.event_class) {
    normalizedFields.event_class = normalizeEventClass(parsedFields.type);
  }

  const timestampSource = parsedFields.timestamp || parsedFields.event_timestamp ||
    (parsedFields.date && parsedFields.time ? `${parsedFields.date}T${parsedFields.time}` : null);
  normalizedFields.timestamp = toIsoTimestamp(timestampSource, eventEnvelope?.received_at);

  if (!fieldLineage.timestamp) {
    fieldLineage.timestamp = recordLineage(
      "timestamp",
      timestampSource || eventEnvelope?.received_at || null,
      timestampSource ? (parsedFields.timestamp ? "timestamp" : "date,time") : "received_at",
      null,
      parserId,
      parserVersion,
      timestampSource ? "parsed timestamp -> timestamp" : "received_at -> timestamp"
    );
  }

  const sourceSeverity = parsedFields.severity ?? parsedFields.level;
  if (sourceSeverity !== undefined) {
    const { severity, severityLabel } = normalizeSeverity(sourceSeverity, parserId);
    if (severity !== undefined) normalizedFields.severity = severity;
    normalizedFields.severity_label = severityLabel;
  }

  return { normalizedFields, fieldLineage };
}

export default normalize;
