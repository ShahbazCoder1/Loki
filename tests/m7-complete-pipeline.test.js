import test from "node:test";
import assert from "node:assert/strict";

import { assembleCompleteEvent } from "../modules/event-assembler.js";
import { processLogPipeline } from "../modules/pipeline.js";

const CISCO_SAMPLE = "%ASA-6-302013: Built inbound TCP connection 12345 for outside:10.0.0.5/1234 to inside:192.168.1.1/443";

test("assembleCompleteEvent creates the required Day 5-6 event envelope", () => {
  const complete = assembleCompleteEvent(
    { event_id: "event-1", processing_state_history: ["RECEIVED"] },
    { parserId: "parser-v1", confidence: 0.98, evidence: ["signature"] },
    {
      parserVersion: "1.0",
      parsedFields: { src_ip: "10.0.0.5" },
      validationStatus: "PASS",
      errors: []
    },
    {
      normalizedFields: { event_class: "network_activity" },
      fieldLineage: { "src_endpoint.ip": { raw_fragment: "10.0.0.5" } }
    }
  );

  assert.deepEqual(complete.source, {
    type: "parser-v1",
    resolution_method: "confidence_scoring",
    resolution_confidence: 0.98,
    resolution_evidence: ["signature"]
  });
  assert.deepEqual(complete.parsed, {
    parser_id: "parser-v1",
    parser_version: "1.0",
    fields: { src_ip: "10.0.0.5" },
    validation_status: "PASS",
    validation_errors: []
  });
  assert.equal(complete.processing_status, "EXPORTED");
});

test("full M2-M4 pipeline normalizes, validates, records lineage, and assembles", async () => {
  const result = await processLogPipeline(CISCO_SAMPLE, { skipExporter: true });

  assert.equal(result.status, "exported");
  assert.equal(result.schemaCheck.valid, true);
  assert.equal(result.event.processing_status, "EXPORTED");
  assert.equal(result.event.source.type, "cisco_asa_v1.0");
  assert.equal(result.event.parsed.parser_id, "cisco_asa_v1.0");
  assert.equal(result.event.parsed.validation_status, "PASS");
  assert.equal(result.event.normalized.src_endpoint.ip, "10.0.0.5");
  assert.equal(result.event.normalized.dst_endpoint.port, 443);
  assert.equal(result.event.normalized.action, "allowed");
  assert.equal(result.event.field_lineage["src_endpoint.ip"].parsed_field, "src_ip");

  assert.deepEqual(
    result.event.provenance.map(entry => entry.stage),
    ["ingest", "resolve", "parse", "normalize", "validate", "export"]
  );
  assert.deepEqual(result.event.processing_state_history, [
    "RECEIVED",
    "RESOLVED",
    "PARSED",
    "NORMALIZED",
    "VALIDATED",
    "EXPORTED"
  ]);
});
