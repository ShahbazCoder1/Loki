import test from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../modules/normalizer.js";
import { validate } from "../modules/schema-validator.js";

const ciscoParser = {
  parser_id: "cisco_asa_v1.0",
  version: "1.0",
  extraction_rules: [
    { field: "src_ip", regex: "src=(\\d+\\.\\d+\\.\\d+\\.\\d+)" },
    { field: "action", regex: "action=(\\w+)" },
    { field: "severity", regex: "severity=(\\d+)" }
  ],
  normalization_mapping: {
    src_ip: "src_endpoint.ip",
    action: "action",
    severity: "severity"
  }
};

test("Normalizer - produces nested OCSF fields and lineage", () => {
  const event = {
    received_at: "2026-08-29T10:00:00.000Z",
    raw: { immutable_payload: "src=10.0.0.5 action=Built severity=4" }
  };
  const result = normalize(event, {
    parserVersion: "1.0",
    parsedFields: { src_ip: "10.0.0.5", action: "Built", severity: "4" }
  }, "cisco_asa_v1.0", { parserDefinition: ciscoParser });

  assert.deepEqual(result.normalizedFields.src_endpoint, { ip: "10.0.0.5" });
  assert.equal(result.normalizedFields.action, "allowed");
  assert.equal(result.normalizedFields.event_class, "network_activity");
  assert.equal(result.normalizedFields.severity, 4);
  assert.equal(result.normalizedFields.severity_label, "medium");
  assert.equal(result.normalizedFields.timestamp, "2026-08-29T10:00:00.000Z");
  assert.equal(result.fieldLineage["src_endpoint.ip"].raw_fragment, "src=10.0.0.5");
  assert.equal(result.fieldLineage.action.mapping_rule, "action -> action");
});

test("Schema validator - accepts valid nested fields and reports invalid fields", () => {
  const valid = validate({
    event_class: "network_activity",
    timestamp: "2026-08-29T10:00:00.000Z",
    action: "allowed",
    src_endpoint: { ip: "10.0.0.5", port: 443 }
  });
  assert.deepEqual(valid, { valid: true, errors: [] });

  const invalid = validate({ event_class: "unknown", action: "accept", src_endpoint: { ip: "999.0.0.1" } });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some(error => error.includes("Missing required field: 'timestamp'")));
  assert.ok(invalid.errors.some(error => error.includes("Invalid enum value for field 'action'")));
  assert.ok(invalid.errors.some(error => error.includes("Invalid ipv4 value for field 'src_endpoint.ip'")));
});
