import { receive } from "./receiver.js";
import { resolve } from "./source-resolver.js";
import { parse } from "./parser-engine.js";
import { getLoadedParsers, getParser } from "./parser-manager.js";
import {
  quarantineEvent,
  deadLetterEvent,
  exportEvent,
  updateQuarantineAIAnalysis
} from "./exporter.js";
import { normalize } from "./normalizer.js";
import { validate } from "./schema-validator.js";
import { assembleCompleteEvent } from "./event-assembler.js";
import { addProvenance } from "./provenance.js";
import { analyzeQuarantinedLog } from "./intelligence.js";

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

  addProvenance(event, "ingest", "receiver", "1.0", "success", {
    event_id: event.event_id,
    integrity_hash: event.raw?.integrity_hash || null
  });

  // 2. Source Resolver Stage
  const loadedParsers = options.parsers || getLoadedParsers();
  const resolution = resolve(event, { parsers: loadedParsers, ...options });

  addProvenance(
    event,
    "resolve",
    "source-resolver",
    "1.0",
    resolution.status === "RESOLVED" ? "success" : "failure",
    resolution
  );

  // 3. Handle UNKNOWN and AMBIGUOUS Resolution States
  if (resolution.status === "UNKNOWN" || resolution.status === "AMBIGUOUS") {
    const reason = resolution.status === "UNKNOWN"
      ? `Unknown log format (confidence: ${resolution.confidence})`
      : `Ambiguous source resolution (top parserId: ${resolution.parserId}, confidence: ${resolution.confidence})`;

    addProvenance(event, "quarantine", "pipeline", "1.0", "success", { reason });

    if (!options.skipExporter) {
      try {
        await quarantineEvent(event, reason);
      } catch (error) {
        event.persistence_error = error.message;
      }
    }

    // Trigger non-blocking async Gemma AI analysis background task
    if (!options.skipExporter && !options.skipAI) {
      const rawPayload = (event.raw && typeof event.raw.immutable_payload === "string")
        ? event.raw.immutable_payload
        : typeof rawLogOrEnvelope === "string" ? rawLogOrEnvelope : "";

      analyzeQuarantinedLog(rawPayload, options)
        .then(aiResult => updateQuarantineAIAnalysis(event.event_id, aiResult))
        .catch(() => {});
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
    parseResult.validationStatus === "FAIL"
      ? "failure"
      : parseResult.validationStatus === "PARTIAL"
        ? "partial"
        : "success",
    {
      parser_id: resolution.parserId,
      fields_extracted: Object.keys(parseResult.parsedFields).length,
      errors: parseResult.errors
    }
  );

  // 5. Handle Parsing Validation FAIL
  if (parseResult.validationStatus === "FAIL") {
    addProvenance(event, "dead_letter", "pipeline", "1.0", "success", {
      errors: parseResult.errors
    });

    if (!options.skipExporter) {
      try {
        await deadLetterEvent(event, parseResult.errors);
      } catch (error) {
        event.persistence_error = error.message;
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

  // 7. Normalize parsed fields
  const normResult = normalize(
    event,
    parseResult,
    resolution.parserId
  );

  event.normalized = normResult.normalizedFields;
  event.field_lineage = normResult.fieldLineage;

  addProvenance(event, "normalize", "normalizer", "1.0", "success", {
    fields_normalized: Object.keys(normResult.normalizedFields).length,
    lineage_entries: Object.keys(normResult.fieldLineage).length
  });

  // 8. Validate normalized fields against schema
  const schemaCheck = validate(normResult.normalizedFields);

  addProvenance(
    event,
    "validate",
    "schema-validator",
    "1.0",
    schemaCheck.valid ? "success" : "failure",
    schemaCheck
  );

  if (!schemaCheck.valid) {
    addProvenance(event, "dead_letter", "pipeline", "1.0", "success", {
      errors: schemaCheck.errors
    });

    if (!options.skipExporter) {
      try {
        await deadLetterEvent(event, schemaCheck.errors);
      } catch (error) {
        event.persistence_error = error.message;
      }
    }

    return {
      status: "dead-letter",
      reason: schemaCheck.errors.join("; ") || "Schema validation failed",
      resolution,
      parseResult,
      normResult,
      schemaCheck,
      event_id: event.event_id,
      event
    };
  }

  // 10. Assemble complete event
  const completeEvent = assembleCompleteEvent(
    event,
    resolution,
    parseResult,
    normResult
  );

  addProvenance(completeEvent, "export", "elasticsearch-exporter", "1.0", "success", {
    index: "ulpf-events",
    skipped: Boolean(options.skipExporter)
  });

  // 11. Export complete event. Tests can skip the network write while still
  // exercising the complete pipeline and final event contract.
  if (!options.skipExporter) await exportEvent(completeEvent);

  return {
    status: "exported",
    event_id: event.event_id,
    resolution,
    parseResult,
    normResult,
    schemaCheck,
    event: completeEvent
  };
}
