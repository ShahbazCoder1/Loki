import { receive } from "./receiver.js";
import { resolve } from "./source-resolver.js";
import { parse } from "./parser-engine.js";
import { getLoadedParsers, getParser } from "./parser-manager.js";
import { normalize } from "./normalizer.js";
import { validate } from "./schema-validator.js";
import { addProvenance } from "./provenance.js";
import { exportEvent, quarantineEvent, deadLetterEvent } from "./exporter.js";

/** Assemble the completed, traceable event envelope ready for export. */
export function assembleCompleteEvent(event, resolution, parseResult, normResult) {
  return {
    ...event,
    source: {
      parserId: resolution.parserId,
      confidence: resolution.confidence,
      evidence: resolution.evidence,
      status: resolution.status
    },
    parsed: {
      parser_id: resolution.parserId,
      parser_version: parseResult.parserVersion,
      fields: parseResult.parsedFields,
      validation_status: parseResult.validationStatus,
      validation_errors: parseResult.errors
    },
    normalized: normResult.normalizedFields,
    field_lineage: normResult.fieldLineage
  };
}

/**
 * Process a raw log or existing event envelope through the integrated pipeline:
 * Receiver -> Source Resolver -> Parser Engine -> next pipeline stage.
 * 
 * @param {string|Object} rawLogOrEnvelope - Raw log string or existing event envelope
 * @param {Object} [options] - Optional override settings (parsers, parsersDir, configPath)
 * @returns {Promise<Object>} Processed result with event envelope, status, resolution, and parseResult
 */
export async function processLogPipeline(rawLogOrEnvelope, options = {}) {
  // 1. Ingestion / Event Envelope Creation
  let event;
  if (typeof rawLogOrEnvelope === "string") {
    event = receive(rawLogOrEnvelope);
  } else if (rawLogOrEnvelope && typeof rawLogOrEnvelope === "object" && rawLogOrEnvelope.raw) {
    event = rawLogOrEnvelope;
  } else {
    throw new Error("Invalid input: must be a raw log string or valid event envelope");
  }
  addProvenance(event, "ingest", "http-receiver", "1.0", "success", { event_id: event.event_id });

  // 2. Source Resolver Stage
  const loadedParsers = options.parsers || getLoadedParsers();
  const resolution = resolve(event, { parsers: loadedParsers, ...options });

  // Attach resolution details to event envelope
  event.source = {
    parserId: resolution.parserId,
    confidence: resolution.confidence,
    evidence: resolution.evidence,
    status: resolution.status
  };
  addProvenance(
    event,
    "resolve",
    "source-resolver",
    "1.0",
    resolution.status === "RESOLVED" ? "success" : resolution.status === "UNKNOWN" ? "failure" : "partial",
    resolution
  );

  // 3. Handle UNKNOWN and AMBIGUOUS Resolution States
  if (resolution.status === "UNKNOWN" || resolution.status === "AMBIGUOUS") {
    const reason = resolution.status === "UNKNOWN"
      ? `Unknown log format (confidence: ${resolution.confidence})`
      : `Ambiguous source resolution (top parserId: ${resolution.parserId}, confidence: ${resolution.confidence})`;
    addProvenance(event, "quarantine", "pipeline-router", "1.0", "success", { reason, resolution });

    if (!options.skipExporter) {
      try {
        await quarantineEvent(event, reason);
      } catch (_) {
        // Exporter errors handled gracefully if Elasticsearch is offline
      }
    }

    return {
      status: "quarantined",
      reason,
      resolution,
      event_id: event.event_id,
      event
    };
  }

  // 4. If RESOLVED, pass parserId and eventEnvelope to Parser Engine
  const parserDef = options.parserDefinition || getParser(resolution.parserId);
  const parseResult = parse(event, resolution.parserId, {
    parserDefinition: parserDef,
    ...options
  });

  // Attach parsing details to event envelope
  event.parsed = {
    parser_id: resolution.parserId,
    parser_version: parseResult.parserVersion,
    fields: parseResult.parsedFields,
    validation_status: parseResult.validationStatus,
    validation_errors: parseResult.errors
  };
  addProvenance(
    event,
    "parse",
    "parser-engine",
    parseResult.parserVersion,
    parseResult.validationStatus === "PASS" ? "success" : parseResult.validationStatus === "PARTIAL" ? "partial" : "failure",
    parseResult
  );

  // 5. Handle Parsing Validation FAIL
  if (parseResult.validationStatus === "FAIL") {
    addProvenance(event, "dead_letter", "pipeline-router", "1.0", "failure", parseResult.errors);

    if (!options.skipExporter) {
      try {
        await deadLetterEvent(event, parseResult.errors);
      } catch (_) {
        // Exporter errors handled gracefully if Elasticsearch is offline
      }
    }

    return {
      status: "dead-letter",
      reason: parseResult.errors.join("; ") || "Parsing validation failed",
      resolution,
      parseResult,
      event_id: event.event_id,
      event
    };
  }

  // 6. Normalize parsed fields and capture field-level lineage.
  const normResult = normalize(event, parseResult, resolution.parserId, { parserDefinition: parserDef });
  event.normalized = normResult.normalizedFields;
  event.field_lineage = normResult.fieldLineage;
  addProvenance(event, "normalize", "ocsf-normalizer", "1.0", "success", {
    fields_normalized: Object.keys(normResult.fieldLineage)
  });

  // 7. Validate the OCSF-aligned output.
  const schemaCheck = validate(normResult.normalizedFields);
  addProvenance(event, "validate", "schema-validator", "1.0", schemaCheck.valid ? "success" : "failure", schemaCheck);

  if (!schemaCheck.valid) {
    addProvenance(event, "dead_letter", "pipeline-router", "1.0", "failure", schemaCheck.errors);
    if (!options.skipExporter) {
      try {
        await deadLetterEvent(event, schemaCheck.errors);
      } catch (_) {
        // Exporter errors handled gracefully if Elasticsearch is offline
      }
    }
    return {
      status: "dead-letter",
      reason: schemaCheck.errors.join("; "),
      resolution,
      parseResult,
      normResult,
      schemaCheck,
      event_id: event.event_id,
      event
    };
  }

  // 8. Assemble and export only after validation succeeds.
  event = assembleCompleteEvent(event, resolution, parseResult, normResult);
  addProvenance(event, "export", "elasticsearch-exporter", "1.0", "success", { index: "ulpf-events" });
  if (!options.skipExporter) await exportEvent(event);

  return {
    status: "exported",
    event_id: event.event_id,
    resolution,
    parseResult,
    normResult,
    schemaCheck,
    event
  };
}

export default processLogPipeline;
