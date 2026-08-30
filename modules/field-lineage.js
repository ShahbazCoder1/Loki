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
    raw_fragment: rawFragment,
    parsed_field: parsedFieldName,
    extraction_rule: extractionRule,
    parser: parserId,
    parser_version: parserVersion,
    mapping_rule: mappingRule
  };
}