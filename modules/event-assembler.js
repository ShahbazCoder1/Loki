export function assembleEvent(
  event,
  resolution,
  parseResult,
  normResult
) {
  return {
    ...event,

    source: {
      parser_id: resolution.parserId,
      confidence: resolution.confidence,
      evidence: resolution.evidence,
      status: resolution.status
    },

    parsed: parseResult.parsedFields,

    normalized: normResult.normalizedFields,

    field_lineage: normResult.fieldLineage
  };
}