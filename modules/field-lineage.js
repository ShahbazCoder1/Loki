/**
 * Build a field-level lineage record for one normalized value.
 *
 * The normalized field path is also used as the key in the event envelope's
 * `field_lineage` object.
 */
export function recordLineage(
  normalizedFieldName,
  rawFragment,
  parsedFieldName,
  extractionRule,
  parserId,
  parserVersion,
  mappingRule
) {
  return {
    normalized_field: normalizedFieldName,
    raw_fragment: rawFragment ?? null,
    parsed_field: parsedFieldName ?? null,
    extraction_rule: extractionRule ?? null,
    parser: parserId,
    parser_version: parserVersion,
    mapping_rule: mappingRule
  };
}

export default recordLineage;
