import test from "node:test";
import assert from "node:assert/strict";
import { recordLineage } from "../modules/field-lineage.js";

test("Field lineage - records every traceability attribute", () => {
  const lineage = recordLineage(
    "src_endpoint.ip",
    "outside:10.0.0.5/1234",
    "src_ip",
    "(?:for|from|src)\\s+(?:[\\w-]+:)?(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})",
    "cisco_asa_v1.0",
    "1.0",
    "src_ip -> src_endpoint.ip"
  );

  assert.deepEqual(lineage, {
    normalized_field: "src_endpoint.ip",
    raw_fragment: "outside:10.0.0.5/1234",
    parsed_field: "src_ip",
    extraction_rule: "(?:for|from|src)\\s+(?:[\\w-]+:)?(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})",
    parser: "cisco_asa_v1.0",
    parser_version: "1.0",
    mapping_rule: "src_ip -> src_endpoint.ip"
  });
});

test("Field lineage - keeps an unavailable raw fragment explicit", () => {
  const lineage = recordLineage(
    "action",
    undefined,
    "action",
    "\\b(Built|Deny)\\b",
    "cisco_asa_v1.0",
    "1.0",
    "action -> action"
  );

  assert.equal(lineage.raw_fragment, null);
  assert.equal(lineage.normalized_field, "action");
});
