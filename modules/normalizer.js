import { getParser } from "./parser-manager.js";
import { recordLineage } from "./field-lineage.js";

const ACTION_MAP = {
  built: "allowed",
  allow: "allowed",
  allowed: "allowed",
  accept: "allowed",
  accepted: "allowed",
  permit: "allowed",
  permitted: "allowed",
  success: "allowed",
  login: "allowed",
  deny: "denied",
  denied: "denied",
  block: "denied",
  blocked: "denied",
  reject: "denied",
  rejected: "denied",
  quarantine: "dropped",
  drop: "dropped",
  dropped: "dropped",
  teardown: "closed",
  close: "closed",
  closed: "closed",
  timeout: "closed",
  "client-rst": "reset",
  "server-rst": "reset",
  reset: "reset",
  "reset-both": "reset",
  log: "logged",
  logged: "logged",
  alert: "logged"
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

const SEVERITY_LABEL_MAP = {
  emergency: "critical",
  alert: "critical",
  critical: "critical",
  error: "high",
  high: "high",
  warning: "medium",
  warn: "medium",
  medium: "medium",
  notice: "low",
  low: "low",
  information: "informational",
  informational: "informational",
  info: "informational",
  debug: "debug"
};

const PROTOCOL_MAP = {
  "1": "icmp",
  "6": "tcp",
  "17": "udp",
  "47": "gre",
  "50": "esp",
  "51": "ah",
  "58": "icmpv6"
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

function leafPaths(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key)
  );
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
  const action = value.trim().toLowerCase();
  return ACTION_MAP[action] || action;
}

function normalizeEventClass(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["traffic", "network", "network_activity"].includes(normalized)) return "network_activity";
  if (["security", "threat", "security_finding"].includes(normalized)) return "security_finding";
  if (["system", "event", "system_activity"].includes(normalized)) return "system_activity";
  return "network_activity";
}

function normalizeProtocol(value) {
  const protocol = String(value).trim().toLowerCase();
  return PROTOCOL_MAP[protocol] || protocol;
}

function toIsoTimestamp(value, fallback) {
  const candidate = value || fallback;
  const parsed = Date.parse(candidate);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function normalizeSeverity(value, parserId) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).trim() !== "") {
    const severity = Math.max(0, Math.min(10, Math.round(numeric)));
    const severityLabel = parserId.startsWith("cisco_asa")
      ? ASA_SEVERITY_LABELS[numeric] || "informational"
      : severity >= 8 ? "critical"
        : severity >= 6 ? "high"
          : severity >= 4 ? "medium"
            : severity >= 1 ? "low"
              : "informational";
    return { severity, severityLabel };
  }

  const label = String(value || "informational").trim().toLowerCase();
  return { severity: undefined, severityLabel: SEVERITY_LABEL_MAP[label] || label };
}

function buildLineage(parser, rawLog, parsedField, targetPath, value, parserId, parserVersion) {
  const rule = findRule(parser, parsedField);
  return recordLineage(
    targetPath,
    findRawFragment(rawLog, rule, value),
    parsedField,
    rule?.regex || null,
    parserId,
    parserVersion,
    `${parsedField} -> ${targetPath}`
  );
}

/** Map parser output to an OCSF-aligned object with complete leaf-level lineage. */
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
    if (targetPath === "protocol") normalizedValue = normalizeProtocol(value);
    if (targetPath.endsWith(".port")) normalizedValue = Number(value);

    if (targetPath === "severity" || targetPath === "severity_label") {
      const normalizedSeverity = normalizeSeverity(value, parserId);
      if (normalizedSeverity.severity !== undefined) {
        normalizedFields.severity = normalizedSeverity.severity;
        fieldLineage.severity = buildLineage(
          parser, rawLog, parsedField, "severity", value, parserId, parserVersion
        );
      }
      normalizedFields.severity_label = normalizedSeverity.severityLabel;
      fieldLineage.severity_label = buildLineage(
        parser, rawLog, parsedField, "severity_label", value, parserId, parserVersion
      );
      continue;
    }

    setPath(normalizedFields, targetPath, normalizedValue);
    fieldLineage[targetPath] = buildLineage(
      parser, rawLog, parsedField, targetPath, value, parserId, parserVersion
    );
  }

  if (!normalizedFields.event_class) {
    const sourceField = parsedFields.type !== undefined ? "type" : null;
    normalizedFields.event_class = normalizeEventClass(parsedFields.type);
    fieldLineage.event_class = sourceField
      ? buildLineage(parser, rawLog, sourceField, "event_class", parsedFields.type, parserId, parserVersion)
      : recordLineage(
          "event_class",
          null,
          null,
          null,
          parserId,
          parserVersion,
          "default network event -> event_class"
        );
  }

  const hasCombinedTimestamp = parsedFields.date && parsedFields.time;
  const timestampSource = parsedFields.timestamp || parsedFields.event_timestamp ||
    (hasCombinedTimestamp ? `${parsedFields.date}T${parsedFields.time}` : null);
  const timestamp = toIsoTimestamp(timestampSource, eventEnvelope?.received_at);
  if (timestamp) normalizedFields.timestamp = timestamp;

  if (timestampSource) {
    const parsedField = parsedFields.timestamp
      ? "timestamp"
      : parsedFields.event_timestamp ? "event_timestamp" : "date,time";
    const timestampFragment = hasCombinedTimestamp
      ? `date=${parsedFields.date} time=${parsedFields.time}`
      : timestampSource;
    fieldLineage.timestamp = recordLineage(
      "timestamp",
      timestampFragment,
      parsedField,
      null,
      parserId,
      parserVersion,
      `${parsedField} -> timestamp`
    );
  } else {
    fieldLineage.timestamp = recordLineage(
      "timestamp",
      eventEnvelope?.received_at || null,
      "received_at",
      null,
      parserId,
      parserVersion,
      "received_at -> timestamp"
    );
  }

  // Guarantee traceability for every normalized leaf, including derived fields.
  for (const fieldPath of leafPaths(normalizedFields)) {
    if (!fieldLineage[fieldPath]) {
      fieldLineage[fieldPath] = recordLineage(
        fieldPath,
        null,
        null,
        null,
        parserId,
        parserVersion,
        `derived value -> ${fieldPath}`
      );
    }
  }

  return { normalizedFields, fieldLineage };
}

export default normalize;
