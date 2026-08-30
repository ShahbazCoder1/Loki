function stageToState(stage, status) {
  const stateMap = {
    ingest: "RECEIVED",
    resolve: "RESOLVED",
    parse: "PARSED",
    normalize: "NORMALIZED",
    validate: "VALIDATED",
    export: "EXPORTED"
  };

  if (status === "failure") {
    return "FAILED";
  }

  if (status === "partial") {
    return `${stage.toUpperCase()}_PARTIAL`;
  }

  return stateMap[stage] || stage.toUpperCase();
}

export function addProvenance(
  eventEnvelope,
  stage,
  component,
  componentVersion,
  status,
  result
) {
  const state = stageToState(stage, status);

  eventEnvelope.provenance.push({
    stage,
    component,
    component_version: componentVersion,
    timestamp: new Date().toISOString(),
    status,
    result
  });

  eventEnvelope.processing_state_history.push(state);
  eventEnvelope.processing_status = state;

  return eventEnvelope;
}