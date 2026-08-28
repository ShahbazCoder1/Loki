import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";
import { resolve } from "../modules/source-resolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load parser definition
function loadParser(filename) {
  const p = path.join(__dirname, "..", "parsers", filename);
  return YAML.parse(fs.readFileSync(p, "utf-8"));
}

// Helper to extract fields using parser extraction rules
function extractFields(rawLog, parser) {
  const extracted = {};
  for (const rule of parser.extraction_rules) {
    try {
      const match = rawLog.match(new RegExp(rule.regex));
      if (match && match[1] !== undefined) {
        extracted[rule.field] = match[1];
      }
    } catch (_) {}
  }
  return extracted;
}

// Helper to load sample dataset
function loadSamples(folder) {
  const p = path.join(__dirname, "..", "test-logs", folder, "samples.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

test("Test Corpus - Cisco ASA Samples Validation", () => {
  const parser = loadParser("cisco_asa_v1.0.yaml");
  const samples = loadSamples("cisco_asa");

  assert.ok(samples.length >= 10, "Should have at least 10 Cisco samples");

  let resolvedCount = 0;
  let extractedCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const rawLog = samples[i];
    
    // 1. Resolution Check
    const res = resolve(rawLog);
    assert.equal(res.status, "RESOLVED", `Sample #${i+1} must be RESOLVED: ${rawLog}`);
    assert.equal(res.parserId, "cisco_asa_v1.0", `Sample #${i+1} must match cisco_asa_v1.0`);
    assert.ok(res.confidence >= 0.70, `Sample #${i+1} confidence should be >= 0.70`);
    resolvedCount++;

    // 2. Extraction Check
    const extracted = extractFields(rawLog, parser);
    assert.ok(extracted.message_id, `Sample #${i+1} must extract message_id`);
    assert.ok(extracted.action || extracted.severity, `Sample #${i+1} must extract action or severity`);
    extractedCount++;
  }

  assert.equal(resolvedCount, samples.length);
  assert.equal(extractedCount, samples.length);
});

test("Test Corpus - Fortinet FortiGate Samples Validation", () => {
  const parser = loadParser("fortinet_v1.0.yaml");
  const samples = loadSamples("fortinet");

  assert.ok(samples.length >= 10, "Should have at least 10 Fortinet samples");

  let resolvedCount = 0;
  let extractedCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const rawLog = samples[i];
    
    // 1. Resolution Check
    const res = resolve(rawLog);
    assert.equal(res.status, "RESOLVED", `Sample #${i+1} must be RESOLVED: ${rawLog}`);
    assert.equal(res.parserId, "fortinet_v1.0", `Sample #${i+1} must match fortinet_v1.0`);
    assert.ok(res.confidence >= 0.70, `Sample #${i+1} confidence should be >= 0.70`);
    resolvedCount++;

    // 2. Extraction Check
    const extracted = extractFields(rawLog, parser);
    for (const reqField of parser.required_fields) {
      assert.ok(extracted[reqField], `Sample #${i+1} missing required field '${reqField}'`);
    }
    extractedCount++;
  }

  assert.equal(resolvedCount, samples.length);
  assert.equal(extractedCount, samples.length);
});

test("Test Corpus - Generic CEF Samples Validation", () => {
  const parser = loadParser("generic_cef_v1.0.yaml");
  const samples = loadSamples("cef");

  assert.ok(samples.length >= 10, "Should have at least 10 CEF samples");

  let resolvedCount = 0;
  let extractedCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const rawLog = samples[i];
    
    // 1. Resolution Check
    const res = resolve(rawLog);
    assert.equal(res.status, "RESOLVED", `Sample #${i+1} must be RESOLVED: ${rawLog}`);
    assert.equal(res.parserId, "generic_cef_v1.0", `Sample #${i+1} must match generic_cef_v1.0`);
    assert.ok(res.confidence >= 0.70, `Sample #${i+1} confidence should be >= 0.70`);
    resolvedCount++;

    // 2. Extraction Check
    const extracted = extractFields(rawLog, parser);
    for (const reqField of parser.required_fields) {
      assert.ok(extracted[reqField], `Sample #${i+1} missing required field '${reqField}'`);
    }
    extractedCount++;
  }

  assert.equal(resolvedCount, samples.length);
  assert.equal(extractedCount, samples.length);
});

test("Test Corpus - Unknown Logs Quarantine & Zero False-Positives", () => {
  const samples = loadSamples("unknown");

  assert.ok(samples.length >= 10, "Should have at least 10 unknown samples");

  let quarantinedCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const rawLog = samples[i];
    const res = resolve(rawLog);
    
    // Negative testing assertion: NO parser must claim this unknown log
    assert.equal(res.status, "UNKNOWN", `Sample #${i+1} should be UNKNOWN: ${rawLog}`);
    assert.equal(res.parserId, null, `Sample #${i+1} must have null parserId`);
    assert.ok(res.confidence < 0.70, `Sample #${i+1} confidence must be < 0.70 (got ${res.confidence})`);
    quarantinedCount++;
  }

  assert.equal(quarantinedCount, samples.length);
});
