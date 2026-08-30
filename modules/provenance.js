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

export function stageToState(stage, status) {
  if (stage === "resolve" && status === "failure") return "UNKNOWN_SOURCE";
  if (stage === "resolve" && status !== "success") return "AMBIGUOUS";
  if (["parse", "validate", "export"].includes(stage) && status === "failure") {
    return "DEAD_LETTER";
  }
  return STATE_BY_STAGE[stage] || String(stage || "UNKNOWN").toUpperCase();
}

/** Append an audit entry and advance the event's processing state. */
export function addProvenance(eventEnvelope, stage, component, componentVersion, status, result = null) {
  if (!eventEnvelope || typeof eventEnvelope !== "object") {
    throw new Error("A valid event envelope is required to record provenance");
  }

  if (!Array.isArray(eventEnvelope.provenance)) eventEnvelope.provenance = [];
  if (!Array.isArray(eventEnvelope.processing_state_history)) {
    eventEnvelope.processing_state_history = [];
  }

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

  if (eventEnvelope.processing_state_history.at(-1) !== state) {
    eventEnvelope.processing_state_history.push(state);
  }

  return eventEnvelope;
}

export default addProvenance;
