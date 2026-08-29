import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  parse,
  loadParserDefinition,
  isValidIPv4,
  isValidIP,
  isValidTimestamp,
  extractFields
} from "../modules/parser-engine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load sample logs corpus
function loadSamples(folder) {
  const p = path.join(__dirname, "..", "test-logs", folder, "samples.json");
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  }
  return [];
}

test("Parser Engine - Cisco ASA Log Parsing", () => {
  const eventEnvelope = {
    raw: {
      immutable_payload: "%ASA-6-302013: Built inbound TCP connection 12345 for outside:10.0.0.5/1234 to inside:192.168.1.1/443"
    }
  };

  const result = parse(eventEnvelope, "cisco_asa_v1.0");

  assert.equal(result.validationStatus, "PASS");
  assert.equal(result.parserVersion, "1.0");
  assert.equal(result.errors.length, 0);

  assert.equal(result.parsedFields.src_ip, "10.0.0.5");
  assert.equal(result.parsedFields.dst_ip, "192.168.1.1");
  assert.equal(result.parsedFields.src_port, "1234");
  assert.equal(result.parsedFields.dst_port, "443");
  assert.equal(result.parsedFields.action, "Built");
});

test("Parser Engine - Fortinet Log Parsing", () => {
  const eventEnvelope = {
    raw: {
      immutable_payload: "date=2026-08-25 time=10:00:00 devname=FGT60E logid=0000000013 type=traffic subtype=forward action=accept srcip=10.0.0.5 dstip=192.168.1.1 srcport=12345 dstport=443 proto=6"
    }
  };

  const result = parse(eventEnvelope, "fortinet_v1.0");

  assert.equal(result.validationStatus, "PASS");
  assert.equal(result.parserVersion, "1.0");
  assert.equal(result.errors.length, 0);

  assert.equal(result.parsedFields.srcip, "10.0.0.5");
  assert.equal(result.parsedFields.dstip, "192.168.1.1");
  assert.equal(result.parsedFields.action, "accept");
  assert.equal(result.parsedFields.type, "traffic");
  assert.equal(result.parsedFields.srcport, "12345");
  assert.equal(result.parsedFields.dstport, "443");
});

test("Parser Engine - Generic CEF Log Parsing", () => {
  const eventEnvelope = {
    raw: {
      immutable_payload: "CEF:0|Palo Alto|Firewall|10.0|100|Connection Allowed|3|src=10.0.0.5 dst=192.168.1.1 dpt=443 act=allow"
    }
  };

  const result = parse(eventEnvelope, "generic_cef_v1.0");

  assert.equal(result.validationStatus, "PASS");
  assert.equal(result.parserVersion, "1.0");
  assert.equal(result.errors.length, 0);

  assert.equal(result.parsedFields.vendor, "Palo Alto");
  assert.equal(result.parsedFields.product, "Firewall");
  assert.equal(result.parsedFields.name, "Connection Allowed");
  assert.equal(result.parsedFields.severity, "3");
  assert.equal(result.parsedFields.src, "10.0.0.5");
  assert.equal(result.parsedFields.dst, "192.168.1.1");
  assert.equal(result.parsedFields.act, "allow");
});

test("Parser Engine - IPv4 & IPv6 Validation", () => {
  // Valid IPv4
  assert.equal(isValidIP("192.168.1.1"), true);
  assert.equal(isValidIP("10.0.0.1"), true);
  assert.equal(isValidIP("255.255.255.255"), true);

  // Invalid IPv4
  assert.equal(isValidIP("256.1.1.1"), false);
  assert.equal(isValidIP("10.0.0"), false);
  assert.equal(isValidIP("invalid_ip"), false);

  // Valid IPv6
  assert.equal(isValidIP("2001:0db8:85a3:0000:0000:8a2e:0370:7334"), true);
  assert.equal(isValidIP("2001:db8::1"), true);
  assert.equal(isValidIP("::1"), true);
  assert.equal(isValidIP("[2001:db8::1]"), true);

  // Invalid IPv6
  assert.equal(isValidIP("2001:0db8:85a3:::8a2e"), false);
  assert.equal(isValidIP("2001:xyz::1"), false);
});

test("Parser Engine - Timestamp Parseability Validation", () => {
  // Valid Timestamps
  assert.equal(isValidTimestamp("2026-08-25T10:00:00Z"), true);
  assert.equal(isValidTimestamp("2026-08-25 10:00:00"), true);
  assert.equal(isValidTimestamp("Aug 25 10:00:00"), true);
  assert.equal(isValidTimestamp("1700000000"), true);
  assert.equal(isValidTimestamp("10:00:00"), true);
  assert.equal(isValidTimestamp("2026-08-25"), true);

  // Invalid Timestamps
  assert.equal(isValidTimestamp("not-a-timestamp"), false);
  assert.equal(isValidTimestamp("invalid date time string"), false);
  assert.equal(isValidTimestamp(""), false);
  assert.equal(isValidTimestamp(null), false);
});

test("Parser Engine - Validation Failure on Missing Required Field", () => {
  const mockParser = {
    parser_id: "mock_parser",
    version: "1.0",
    extraction_rules: [
      { field: "src_ip", regex: "src=(\\S+)" }
    ],
    required_fields: ["src_ip", "action"]
  };

  const eventEnvelope = {
    raw: {
      immutable_payload: "src=10.0.0.5"
    }
  };

  const result = parse(eventEnvelope, "mock_parser", { parserDefinition: mockParser });

  assert.equal(result.validationStatus, "FAIL");
  assert.ok(result.errors.some(err => err.includes("Missing required field: 'action'")));
  assert.equal(result.parsedFields.src_ip, "10.0.0.5");
});

test("Parser Engine - Partial Status on Invalid IP or Timestamp Format", () => {
  const mockParser = {
    parser_id: "mock_parser_ip",
    version: "1.0",
    extraction_rules: [
      { field: "src_ip", regex: "src=(\\S+)" },
      { field: "timestamp", regex: "time=(\\S+)" },
      { field: "action", regex: "act=(\\S+)" }
    ],
    required_fields: ["action"]
  };

  const eventEnvelope = {
    raw: {
      immutable_payload: "src=999.999.999.999 time=invalid_time act=allow"
    }
  };

  const result = parse(eventEnvelope, "mock_parser_ip", { parserDefinition: mockParser });

  assert.equal(result.validationStatus, "PARTIAL");
  assert.ok(result.errors.some(err => err.includes("Invalid IP address format")));
  assert.ok(result.errors.some(err => err.includes("Invalid timestamp format")));
  assert.equal(result.parsedFields.action, "allow");
});

test("Parser Engine - Non-existent Parser ID Handling", () => {
  const result = parse("sample log text", "non_existent_parser_v9.9");

  assert.equal(result.validationStatus, "FAIL");
  assert.equal(result.parserVersion, "unknown");
  assert.ok(result.errors.some(err => err.includes("Parser definition not found")));
});

test("Parser Engine - Empty Input Handling", () => {
  const resultNull = parse(null, "cisco_asa_v1.0");
  assert.equal(resultNull.validationStatus, "FAIL");

  const resultEmpty = parse("", "cisco_asa_v1.0");
  assert.equal(resultEmpty.validationStatus, "FAIL");
});

test("Parser Engine - Corpus Samples Parsing Verification", () => {
  const ciscoSamples = loadSamples("cisco_asa");
  assert.ok(ciscoSamples.length >= 10);
  for (const sample of ciscoSamples) {
    const res = parse(sample, "cisco_asa_v1.0");
    assert.ok(res.parsedFields.message_id, `Cisco ASA sample missing message_id: ${sample}`);
    assert.ok(res.parsedFields.action || res.parsedFields.severity, `Cisco ASA sample missing action/severity: ${sample}`);
  }

  const fortinetSamples = loadSamples("fortinet");
  assert.ok(fortinetSamples.length >= 10);
  for (const sample of fortinetSamples) {
    const res = parse(sample, "fortinet_v1.0");
    assert.equal(res.validationStatus, "PASS", `Fortinet sample failed parsing: ${sample}`);
    assert.ok(res.parsedFields.srcip);
    assert.ok(res.parsedFields.action);
  }

  const cefSamples = loadSamples("cef");
  assert.ok(cefSamples.length >= 10);
  for (const sample of cefSamples) {
    const res = parse(sample, "generic_cef_v1.0");
    assert.equal(res.validationStatus, "PASS", `CEF sample failed parsing: ${sample}`);
    assert.ok(res.parsedFields.vendor);
    assert.ok(res.parsedFields.product);
  }
});
