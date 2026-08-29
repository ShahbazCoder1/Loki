import { receive } from "./receiver.js";
import { resolve } from "./source-resolver.js";
import { parse } from "./parser-engine.js";
import { getLoadedParsers, getParser } from "./parser-manager.js";
import { quarantineEvent, deadLetterEvent } from "./exporter.js";

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

  // 3. Handle UNKNOWN and AMBIGUOUS Resolution States
  if (resolution.status === "UNKNOWN" || resolution.status === "AMBIGUOUS") {
    event.processing_status = "QUARANTINED";
    if (Array.isArray(event.processing_state_history)) {
      event.processing_state_history.push("QUARANTINED");
    }

    const reason = resolution.status === "UNKNOWN"
      ? `Unknown log format (confidence: ${resolution.confidence})`
      : `Ambiguous source resolution (top parserId: ${resolution.parserId}, confidence: ${resolution.confidence})`;

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

  // 5. Handle Parsing Validation FAIL
  if (parseResult.validationStatus === "FAIL") {
    event.processing_status = "DEAD_LETTER";
    if (Array.isArray(event.processing_state_history)) {
      event.processing_state_history.push("DEAD_LETTER");
    }

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

  // 6. Parsing Validation PASS or PARTIAL -> Advance to next stage (PARSED)
  event.processing_status = "PARSED";
  if (Array.isArray(event.processing_state_history)) {
    event.processing_state_history.push("PARSED");
  }

  return {
    status: "parsed",
    event_id: event.event_id,
    resolution,
    parseResult,
    event
  };
}

export default processLogPipeline;
