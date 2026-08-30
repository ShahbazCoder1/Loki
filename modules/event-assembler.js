export function assembleCompleteEvent(
  eventEnvelope,
  resolution,
  parseResult,
  normResult
) {
  return {
    ...eventEnvelope,

    source: {
      type: resolution.parserId,
      resolution_method: "confidence_scoring",
      resolution_confidence: resolution.confidence,
      resolution_evidence: resolution.evidence
    },

    parsed: {
      parser_id: resolution.parserId,
      parser_version: parseResult.parserVersion,
      fields: parseResult.parsedFields,
      validation_status: parseResult.validationStatus,
      validation_errors: parseResult.errors
    },

    normalized: normResult.normalizedFields,

    field_lineage: normResult.fieldLineage,

    processing_status: "EXPORTED"
  };
}

// Backward-compatible name for callers written before the complete envelope contract.
export const assembleEvent = assembleCompleteEvent;
