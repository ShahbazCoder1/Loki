import test from "node:test";
import assert from "node:assert/strict";
import { addProvenance, stageToState } from "../modules/provenance.js";

test("Provenance - records an audit entry and advances state", () => {
  const event = { provenance: [], processing_state_history: ["RECEIVED"] };
  addProvenance(event, "normalize", "ocsf-normalizer", "1.0", "success", { fields_normalized: ["action"] });

  assert.equal(event.processing_status, "NORMALIZED");
  assert.deepEqual(event.processing_state_history, ["RECEIVED", "NORMALIZED"]);
  assert.equal(event.provenance.length, 1);
  assert.equal(event.provenance[0].component, "ocsf-normalizer");
  assert.ok(!Number.isNaN(Date.parse(event.provenance[0].timestamp)));
});

test("Provenance - maps failure and quarantine states", () => {
  assert.equal(stageToState("validate", "failure"), "DEAD_LETTER");
  assert.equal(stageToState("quarantine", "success"), "QUARANTINED");
});
