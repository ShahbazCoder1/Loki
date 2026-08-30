import test from "node:test";
import assert from "node:assert/strict";
import { validateParserDefinition } from "../routes/parsers.js";
import { limitFrom } from "../routes/quarantine.js";

test("Parser API validation accepts a complete versioned parser", () => {
  const errors = validateParserDefinition({
    parser_id: "example_v1.0",
    detection: { signatures: ["EXAMPLE"] },
    extraction_rules: [{ field: "action", regex: "action=(\\w+)" }],
    normalization_mapping: { action: "action" }
  });
  assert.deepEqual(errors, []);
});

test("Parser API validation rejects unsafe or incomplete definitions", () => {
  const errors = validateParserDefinition({
    parser_id: "../unsafe",
    detection: { signatures: [] },
    extraction_rules: [{ field: "action", regex: "(" }]
  });
  assert.ok(errors.length >= 4);
});

test("Quarantine API limit is bounded", () => {
  assert.equal(limitFrom(undefined), 50);
  assert.equal(limitFrom("0"), 1);
  assert.equal(limitFrom("250"), 100);
  assert.equal(limitFrom("20"), 20);
});
