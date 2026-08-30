const STATE_BY_STAGE = {
  ingest: "RECEIVED",
  resolve: "RESOLVED",
  parse: "PARSED",
  normalize: "NORMALIZED",
  validate: "VALIDATED",
  export: "EXPORTED",
  quarantine: "QUARANTINED",
  dead_letter: "DEAD_LETTER"
};

/** Convert a pipeline stage and outcome into the event's processing state. */
export function stageToState(stage, status) {
  if (stage === "resolve" && status === "failure") return "UNKNOWN";
  if (stage === "resolve" && status !== "success") return "AMBIGUOUS";
  if (["parse", "validate", "export"].includes(stage) && status === "failure") return "DEAD_LETTER";
  return STATE_BY_STAGE[stage] || String(stage || "UNKNOWN").toUpperCase();
}

/** Append a provenance entry and advance the mutable event envelope's state. */
export function addProvenance(eventEnvelope, stage, component, componentVersion, status, result = null) {
  if (!eventEnvelope || typeof eventEnvelope !== "object") {
    throw new Error("A valid event envelope is required to record provenance");
  }

  if (!Array.isArray(eventEnvelope.provenance)) eventEnvelope.provenance = [];
  if (!Array.isArray(eventEnvelope.processing_state_history)) eventEnvelope.processing_state_history = [];

  const state = stageToState(stage, status);
  eventEnvelope.provenance.push({
    stage,
    component,
    component_version: componentVersion,
    timestamp: new Date().toISOString(),
    status,
    result
  });
  eventEnvelope.processing_status = state;
  eventEnvelope.processing_state_history.push(state);
  return eventEnvelope;
}

export default addProvenance;
