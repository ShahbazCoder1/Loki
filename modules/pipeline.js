import { receive } from "./receiver.js";
import { resolve } from "./source-resolver.js";
import { parse } from "./parser-engine.js";
import { getLoadedParsers, getParser } from "./parser-manager.js";
import { normalize } from "./normalizer.js";
import { validate } from "./schema-validator.js";
import { addProvenance } from "./provenance.js";
import { exportEvent, quarantineEvent, deadLetterEvent } from "./exporter.js";

function sourceDetails(resolution) {
  return {
    type: resolution.parserId,
    resolution_method: "confidence_scoring",
    resolution_confidence: resolution.confidence,
    resolution_evidence: resolution.evidence,
    resolution_status: resolution.status
  };
}

/** Assemble the completed and traceable event envelope. */
export function assembleCompleteEvent(event, resolution, parseResult, normResult) {
  return {
    ...event,
    source: sourceDetails(resolution),
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

function removeLastExportState(event) {
  if (event.provenance?.at(-1)?.stage === "export") event.provenance.pop();
  if (event.processing_state_history?.at(-1) === "EXPORTED") {
    event.processing_state_history.pop();
  }
}

function errorMessage(error) {
  return error?.message || error?.name || String(error || "Unknown exporter error");
}

/** Receiver -> Resolver -> Parser -> Normalizer -> Validator -> Exporter. */
export async function processLogPipeline(rawLogOrEnvelope, options = {}) {
  let event;
  if (typeof rawLogOrEnvelope === "string") {
    event = receive(rawLogOrEnvelope);
  } else if (rawLogOrEnvelope && typeof rawLogOrEnvelope === "object" && rawLogOrEnvelope.raw) {
    event = rawLogOrEnvelope;
  } else {
    throw new Error("Invalid input: must be a raw log string or valid event envelope");
  }

  addProvenance(event, "ingest", "http-receiver", "1.0", "success", {
    event_id: event.event_id
  });

  const loadedParsers = options.parsers || getLoadedParsers();
  const resolution = resolve(event, { parsers: loadedParsers, ...options });
  event.source = sourceDetails(resolution);
  addProvenance(
    event,
    "resolve",
    "source-resolver",
    "1.0",
    resolution.status === "RESOLVED"
      ? "success"
      : resolution.status === "UNKNOWN" ? "failure" : "partial",
    resolution
  );

  if (resolution.status === "UNKNOWN" || resolution.status === "AMBIGUOUS") {
    const reason = resolution.status === "UNKNOWN"
      ? `Unknown log format (confidence: ${resolution.confidence})`
      : `Ambiguous source resolution (top parserId: ${resolution.parserId}, confidence: ${resolution.confidence})`;
    addProvenance(event, "quarantine", "pipeline-router", "1.0", "success", {
      reason,
      resolution
    });

    let persistenceError = null;
    if (!options.skipExporter) {
      try {
        await quarantineEvent(event, reason);
      } catch (error) {
        persistenceError = errorMessage(error);
        event.provenance.push({
          stage: "export",
          component: "elasticsearch-exporter",
          component_version: "1.0",
          timestamp: new Date().toISOString(),
          status: "failure",
          result: { target: "ulpf-quarantine", error: persistenceError }
        });
      }
    }

    return {
      status: "quarantined",
      reason,
      persistenceError,
      resolution,
      event_id: event.event_id,
      event
    };
  }

  const parserDef = options.parserDefinition || getParser(resolution.parserId);
  const parseResult = parse(event, resolution.parserId, {
    ...options,
    parserDefinition: parserDef
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
    parseResult.validationStatus === "PASS"
      ? "success"
      : parseResult.validationStatus === "PARTIAL" ? "partial" : "failure",
    parseResult
  );

  if (parseResult.validationStatus === "FAIL") {
    addProvenance(event, "dead_letter", "pipeline-router", "1.0", "failure", parseResult.errors);
    let persistenceError = null;
    if (!options.skipExporter) {
      try {
        await deadLetterEvent(event, parseResult.errors);
      } catch (error) {
        persistenceError = errorMessage(error);
      }
    }
    return {
      status: "dead-letter",
      reason: parseResult.errors.join("; ") || "Parsing validation failed",
      persistenceError,
      resolution,
      parseResult,
      event_id: event.event_id,
      event
    };
  }

  const normResult = normalize(event, parseResult, resolution.parserId, {
    parserDefinition: parserDef
  });
  event.normalized = normResult.normalizedFields;
  event.field_lineage = normResult.fieldLineage;
  addProvenance(event, "normalize", "ocsf-normalizer", "1.0", "success", {
    fields_normalized: Object.keys(normResult.fieldLineage)
  });

  const schemaCheck = validate(normResult.normalizedFields, {
    schema: options.schema,
    schemaPath: options.schemaPath
  });
  event.normalized.schema_validation_status = schemaCheck.valid ? "PASS" : "FAIL";
  event.normalized.schema_validation_errors = schemaCheck.errors;
  addProvenance(
    event,
    "validate",
    "schema-validator",
    "1.0",
    schemaCheck.valid ? "success" : "failure",
    schemaCheck
  );

  if (!schemaCheck.valid) {
    addProvenance(event, "dead_letter", "pipeline-router", "1.0", "failure", schemaCheck.errors);
    let persistenceError = null;
    if (!options.skipExporter) {
      try {
        await deadLetterEvent(event, schemaCheck.errors);
      } catch (error) {
        persistenceError = errorMessage(error);
      }
    }
    return {
      status: "dead-letter",
      reason: schemaCheck.errors.join("; "),
      persistenceError,
      resolution,
      parseResult,
      normResult,
      schemaCheck,
      event_id: event.event_id,
      event
    };
  }

  event = assembleCompleteEvent(event, resolution, parseResult, normResult);
  event.normalized.schema_validation_status = "PASS";
  event.normalized.schema_validation_errors = [];

  addProvenance(event, "export", "elasticsearch-exporter", "1.0", "success", {
    index: "ulpf-events",
    skipped: Boolean(options.skipExporter)
  });

  if (!options.skipExporter) {
    try {
      await exportEvent(event);
    } catch (error) {
      removeLastExportState(event);
      addProvenance(event, "export", "elasticsearch-exporter", "1.0", "failure", {
        index: "ulpf-events",
        error: errorMessage(error)
      });
      throw error;
    }
  }

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
