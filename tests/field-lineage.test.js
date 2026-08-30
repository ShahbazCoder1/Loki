import test from "node:test";
import assert from "node:assert/strict";
import { recordLineage } from "../modules/field-lineage.js";

test("Field lineage records every traceability attribute", () => {
  const lineage = recordLineage(
    "src_endpoint.ip",
    "outside:10.0.0.5/1234",
    "src_ip",
    "src=(\\S+)",
    "cisco_asa_v1.0",
    "1.0",
    "src_ip -> src_endpoint.ip"
  );

  assert.equal(lineage.normalized_field, "src_endpoint.ip");
  assert.equal(lineage.raw_fragment, "outside:10.0.0.5/1234");
  assert.equal(lineage.parsed_field, "src_ip");
  assert.equal(lineage.parser, "cisco_asa_v1.0");
  assert.equal(lineage.parser_version, "1.0");
});

test("Field lineage keeps unavailable source information explicit", () => {
  const lineage = recordLineage("event_class", undefined, null, null, "parser", "1.0", "derived");
  assert.equal(lineage.raw_fragment, null);
  assert.equal(lineage.parsed_field, null);
  assert.equal(lineage.extraction_rule, null);
});
