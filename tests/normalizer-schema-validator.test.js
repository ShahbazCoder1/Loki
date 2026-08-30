import test from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../modules/normalizer.js";
import { validate } from "../modules/schema-validator.js";

const parser = {
  parser_id: "test_parser_v1.0",
  version: "1.0",
  extraction_rules: [
    { field: "src_ip", regex: "src=(\\S+)" },
    { field: "src_port", regex: "spt=(\\d+)" },
    { field: "action", regex: "action=(\\S+)" },
    { field: "level", regex: "level=(\\S+)" },
    { field: "proto", regex: "proto=(\\S+)" }
  ],
  normalization_mapping: {
    src_ip: "src_endpoint.ip",
    src_port: "src_endpoint.port",
    action: "action",
    level: "severity_label",
    proto: "protocol"
  }
};

test("Normalizer produces typed OCSF fields with lineage for every leaf", () => {
  const event = {
    received_at: "2026-08-29T10:00:00.000Z",
    raw: { immutable_payload: "src=10.0.0.5 spt=443 action=client-rst level=warning proto=6" }
  };
  const result = normalize(event, {
    parserVersion: "1.0",
    parsedFields: {
      src_ip: "10.0.0.5",
      src_port: "443",
      action: "client-rst",
      level: "warning",
      proto: "6"
    }
  }, "test_parser_v1.0", { parserDefinition: parser });

  assert.deepEqual(result.normalizedFields.src_endpoint, { ip: "10.0.0.5", port: 443 });
  assert.equal(result.normalizedFields.action, "reset");
  assert.equal(result.normalizedFields.severity_label, "medium");
  assert.equal(result.normalizedFields.protocol, "tcp");
  assert.equal(result.normalizedFields.event_class, "network_activity");
  assert.equal(result.normalizedFields.timestamp, "2026-08-29T10:00:00.000Z");

  for (const path of [
    "src_endpoint.ip",
    "src_endpoint.port",
    "action",
    "severity_label",
    "protocol",
    "event_class",
    "timestamp"
  ]) {
    assert.ok(result.fieldLineage[path], `Missing lineage for ${path}`);
  }
});

test("Schema validator enforces required fields, strict types, enums, and ISO timestamps", () => {
  const valid = validate({
    event_class: "network_activity",
    timestamp: "2026-08-29T10:00:00.000Z",
    action: "allowed",
    src_endpoint: { ip: "10.0.0.5", port: 443 }
  });
  assert.deepEqual(valid, { valid: true, errors: [] });

  const invalid = validate({
    event_class: "unknown",
    timestamp: "August 29 2026",
    action: "accept",
    src_endpoint: { ip: "999.0.0.1", port: "443" }
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some(error => error.includes("Invalid enum value for field 'action'")));
  assert.ok(invalid.errors.some(error => error.includes("Invalid iso8601 value")));
  assert.ok(invalid.errors.some(error => error.includes("Invalid integer value")));
  assert.ok(invalid.errors.some(error => error.includes("Invalid ipv4 value")));
});
