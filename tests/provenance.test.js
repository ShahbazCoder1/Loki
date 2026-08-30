import test from "node:test";
import assert from "node:assert/strict";
import { addProvenance, stageToState } from "../modules/provenance.js";

test("Provenance records an audit entry without duplicating a state", () => {
  const event = {
    provenance: [],
    processing_status: "RECEIVED",
    processing_state_history: ["RECEIVED"]
  };
  addProvenance(event, "ingest", "http-receiver", "1.0", "success");
  addProvenance(event, "normalize", "ocsf-normalizer", "1.0", "success", {
    fields_normalized: ["action"]
  });

  assert.deepEqual(event.processing_state_history, ["RECEIVED", "NORMALIZED"]);
  assert.equal(event.provenance.length, 2);
  assert.ok(!Number.isNaN(Date.parse(event.provenance[1].timestamp)));
});

test("Provenance maps failure and quarantine states", () => {
  assert.equal(stageToState("validate", "failure"), "DEAD_LETTER");
  assert.equal(stageToState("quarantine", "success"), "QUARANTINED");
  assert.equal(stageToState("resolve", "failure"), "UNKNOWN_SOURCE");
});
