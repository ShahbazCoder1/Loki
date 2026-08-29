import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { processLogPipeline } from "../modules/pipeline.js";
import parserManager, {
  startWatcher,
  stopWatcher,
  loadAllParsers,
  getLoadedParsers,
  resetParsersCache,
  getParsersDir
} from "../modules/parser-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const parsersDir = getParsersDir();

// Sample raw log strings
const CISCO_SAMPLE = "%ASA-6-302013: Built inbound TCP connection 12345 for outside:10.0.0.5/1234 to inside:192.168.1.1/443";
const FORTINET_SAMPLE = "date=2026-08-25 time=10:00:00 devname=FGT60E logid=0000000013 type=traffic subtype=forward action=accept srcip=10.0.0.5 dstip=192.168.1.1 srcport=12345 dstport=443 proto=6";
const CEF_SAMPLE = "CEF:0|Palo Alto|Firewall|10.0|100|Connection Allowed|3|src=10.0.0.5 dst=192.168.1.1 dpt=443 spt=12345 act=allow";
const UNKNOWN_SAMPLE = "Oct 11 14:32:01 unknown-host random_process[1234]: Completely unparseable arbitrary custom system message log line";

test("Integration - Full Pipeline for Cisco ASA (Receiver -> Source Resolver -> Parser Engine)", async () => {
  const result = await processLogPipeline(CISCO_SAMPLE, { skipExporter: true });

  assert.equal(result.status, "parsed");
  assert.ok(result.event_id);
  assert.equal(result.resolution.status, "RESOLVED");
  assert.equal(result.resolution.parserId, "cisco_asa_v1.0");
  assert.equal(result.parseResult.validationStatus, "PASS");
  assert.equal(result.parseResult.parserVersion, "1.0");
  assert.equal(result.parseResult.parsedFields.src_ip, "10.0.0.5");
  assert.equal(result.parseResult.parsedFields.dst_ip, "192.168.1.1");
  assert.equal(result.event.processing_status, "PARSED");
  assert.ok(result.event.processing_state_history.includes("PARSED"));
});

test("Integration - Full Pipeline for Fortinet FortiGate", async () => {
  const result = await processLogPipeline(FORTINET_SAMPLE, { skipExporter: true });

  assert.equal(result.status, "parsed");
  assert.equal(result.resolution.status, "RESOLVED");
  assert.equal(result.resolution.parserId, "fortinet_v1.0");
  assert.equal(result.parseResult.validationStatus, "PASS");
  assert.equal(result.parseResult.parsedFields.srcip, "10.0.0.5");
});

test("Integration - Full Pipeline for Generic CEF", async () => {
  const result = await processLogPipeline(CEF_SAMPLE, { skipExporter: true });

  assert.equal(result.status, "parsed");
  assert.equal(result.resolution.status, "RESOLVED");
  assert.equal(result.resolution.parserId, "generic_cef_v1.0");
  assert.equal(result.parseResult.validationStatus, "PASS");
  assert.equal(result.parseResult.parsedFields.src, "10.0.0.5");
});

test("Integration - UNKNOWN Source Handling -> Quarantined State", async () => {
  const result = await processLogPipeline(UNKNOWN_SAMPLE, { skipExporter: true });

  assert.equal(result.status, "quarantined");
  assert.equal(result.resolution.status, "UNKNOWN");
  assert.equal(result.resolution.parserId, null);
  assert.equal(result.event.processing_status, "QUARANTINED");
  assert.ok(result.event.processing_state_history.includes("QUARANTINED"));
  assert.ok(result.reason.includes("Unknown log format"));
});

test("Integration - AMBIGUOUS Source Handling -> Quarantined State", async () => {
  // Create a synthetic ambiguous case by options override with identical parsers
  const parserA = {
    parser_id: "parser_a",
    version: "1.0",
    detection: { signatures: ["TEST_LOG"], structure: "syslog_text", keywords: ["TEST"] }
  };
  const parserB = {
    parser_id: "parser_b",
    version: "1.0",
    detection: { signatures: ["TEST_LOG"], structure: "syslog_text", keywords: ["TEST"] }
  };

  const result = await processLogPipeline("TEST_LOG message from device", {
    parsers: [parserA, parserB],
    skipExporter: true
  });

  assert.equal(result.status, "quarantined");
  assert.equal(result.resolution.status, "AMBIGUOUS");
  assert.ok(result.resolution.parserId);
  assert.equal(result.event.processing_status, "QUARANTINED");
});

test("Hot Reload - Dynamic Detection of Parser File Addition", async () => {
  startWatcher(parsersDir, 50);

  const initialParsersCount = getLoadedParsers().length;
  const tempYamlPath = path.join(parsersDir, "temp_custom_v1.0.yaml");

  const customYamlContent = `
parser_id: temp_custom_v1.0
version: "1.0"
device_family: CustomDevice
description: "Temporary custom log parser"
detection:
  signatures:
    - "CUSTOM_SYS_PREFIX"
  structure: "syslog_text"
  keywords:
    - "CUSTOM"
extraction_rules:
  - field: "src_ip"
    regex: "src=(\\\\d+\\\\.\\\\d+\\\\.\\\\d+\\\\.\\\\d+)"
  - field: "action"
    regex: "action=(\\\\w+)"
required_fields:
  - "src_ip"
  - "action"
`;

  try {
    fs.writeFileSync(tempYamlPath, customYamlContent, "utf-8");

    // Wait for fs.watch event + debounce
    await new Promise(resolve => setTimeout(resolve, 250));

    const updatedParsers = getLoadedParsers();
    assert.equal(updatedParsers.length, initialParsersCount + 1);
    assert.ok(updatedParsers.some(p => p.parser_id === "temp_custom_v1.0"));

    // Verify pipeline uses the newly reloaded parser
    const pipelineResult = await processLogPipeline("CUSTOM_SYS_PREFIX src=172.16.0.42 action=ALLOW", { skipExporter: true });
    assert.equal(pipelineResult.status, "parsed");
    assert.equal(pipelineResult.resolution.parserId, "temp_custom_v1.0");
    assert.equal(pipelineResult.parseResult.parsedFields.src_ip, "172.16.0.42");

  } finally {
    // Cleanup temporary file
    if (fs.existsSync(tempYamlPath)) {
      fs.unlinkSync(tempYamlPath);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    stopWatcher();
  }
});

test("Hot Reload - Safe Handling of Temporary/Incomplete YAML Files", async () => {
  startWatcher(parsersDir, 50);

  const tempYamlPath = path.join(parsersDir, "temp_invalid_v1.0.yaml");

  try {
    // Write invalid/incomplete YAML content
    fs.writeFileSync(tempYamlPath, "incomplete_yaml: [invalid: : :", "utf-8");
    await new Promise(resolve => setTimeout(resolve, 250));

    // The manager should not crash and should safely ignore invalid syntax
    const parsers = getLoadedParsers();
    assert.ok(Array.isArray(parsers));
    assert.ok(!parsers.some(p => p._filename === "temp_invalid_v1.0.yaml"));

    // Write valid content to the same file
    const validContent = `
parser_id: temp_invalid_v1.0
version: "1.0"
detection:
  signatures: ["RECOVERED_SIG"]
  structure: "syslog_text"
`;
    fs.writeFileSync(tempYamlPath, validContent, "utf-8");
    await new Promise(resolve => setTimeout(resolve, 250));

    const updatedParsers = getLoadedParsers();
    assert.ok(updatedParsers.some(p => p.parser_id === "temp_invalid_v1.0"));

  } finally {
    if (fs.existsSync(tempYamlPath)) {
      fs.unlinkSync(tempYamlPath);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    stopWatcher();
  }
});

test("Hot Reload - Dynamic Detection of Parser File Deletion", async () => {
  const tempYamlPath = path.join(parsersDir, "temp_deleteme_v1.0.yaml");
  fs.writeFileSync(tempYamlPath, "parser_id: temp_deleteme_v1.0\nversion: '1.0'\n", "utf-8");

  startWatcher(parsersDir, 50);
  await new Promise(resolve => setTimeout(resolve, 250));

  const parsersBeforeDelete = getLoadedParsers();
  assert.ok(parsersBeforeDelete.some(p => p.parser_id === "temp_deleteme_v1.0"));

  // Delete file
  fs.unlinkSync(tempYamlPath);
  await new Promise(resolve => setTimeout(resolve, 250));

  const parsersAfterDelete = getLoadedParsers();
  assert.ok(!parsersAfterDelete.some(p => p.parser_id === "temp_deleteme_v1.0"));

  stopWatcher();
});
