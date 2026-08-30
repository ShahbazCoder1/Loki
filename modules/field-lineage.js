/**
 * Create an immutable field-level lineage record for a normalized value.
 *
 * The caller uses the normalized field path (for example, "src_endpoint.ip")
 * as the key in the event's `field_lineage` object.
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
    parsed_field: parsedFieldName,
    extraction_rule: extractionRule,
    parser: parserId,
    parser_version: parserVersion,
    mapping_rule: mappingRule
  };
}

export default recordLineage;
