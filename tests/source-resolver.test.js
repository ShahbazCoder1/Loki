import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "../ulpf-prototype/modules/source-resolver.js";

test("Source Resolver - Cisco ASA Log Resolution", () => {
  const eventEnvelope = {
    raw: {
      immutable_payload: "%ASA-6-302013: Built inbound TCP connection 12345 for outside:10.0.0.5/1234 to inside:192.168.1.1/443"
    }
  };

  const result = resolve(eventEnvelope);

  assert.equal(result.status, "RESOLVED");
  assert.equal(result.parserId, "cisco_asa_v1.0");
  assert.equal(result.confidence, 1.0);
  assert.ok(result.evidence["cisco_asa_v1.0"]);
  assert.equal(result.evidence["cisco_asa_v1.0"].breakdown.signature, 0.40);
  assert.equal(result.evidence["cisco_asa_v1.0"].breakdown.structural, 0.35);
  assert.equal(result.evidence["cisco_asa_v1.0"].breakdown.metadata, 0.25);
});

test("Source Resolver - Fortinet Log Resolution", () => {
  const eventEnvelope = {
    raw: {
      immutable_payload: "date=2026-08-25 time=10:00:00 devname=FGT60E logid=0000000013 type=traffic subtype=forward action=accept srcip=10.0.0.5 dstip=192.168.1.1"
    }
  };

  const result = resolve(eventEnvelope);

  assert.equal(result.status, "RESOLVED");
  assert.equal(result.parserId, "fortinet_v1.0");
  assert.equal(result.confidence, 1.0);
  assert.ok(result.evidence["fortinet_v1.0"]);
  assert.equal(result.evidence["fortinet_v1.0"].breakdown.signature, 0.40);
  assert.equal(result.evidence["fortinet_v1.0"].breakdown.structural, 0.35);
  assert.equal(result.evidence["fortinet_v1.0"].breakdown.metadata, 0.25);
});

test("Source Resolver - Generic CEF Log Resolution", () => {
  const eventEnvelope = {
    raw: {
      immutable_payload: "CEF:0|Palo Alto|Firewall|10.0|100|Connection Allowed|3|src=10.0.0.5 dst=192.168.1.1 dpt=443 act=allow"
    }
  };

  const result = resolve(eventEnvelope);

  assert.equal(result.status, "RESOLVED");
  assert.equal(result.parserId, "generic_cef_v1.0");
  assert.equal(result.confidence, 1.0);
  assert.ok(result.evidence["generic_cef_v1.0"]);
  assert.equal(result.evidence["generic_cef_v1.0"].breakdown.signature, 0.40);
  assert.equal(result.evidence["generic_cef_v1.0"].breakdown.structural, 0.35);
  assert.equal(result.evidence["generic_cef_v1.0"].breakdown.metadata, 0.25);
});

test("Source Resolver - Unknown Log Format", () => {
  const eventEnvelope = {
    raw: {
      immutable_payload: "<190>2026-08-25T10:00:00Z fw01 filterlog[1234]: 5,,,1000000103,em0,match,block,in,4,0x0,,64,12345,0,DF,6,tcp,60,10.0.0.5,192.168.1.1"
    }
  };

  const result = resolve(eventEnvelope);

  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.parserId, null);
  assert.ok(result.confidence < 0.70);
});

test("Source Resolver - Ambiguous Scoring (Margin < 0.10)", () => {
  const mockParsers = [
    {
      parser_id: "parser_a",
      detection: {
        signatures: ["TEST_LOG"],
        structure: "syslog_text",
        keywords: ["common_kw"]
      }
    },
    {
      parser_id: "parser_b",
      detection: {
        signatures: ["TEST_LOG"],
        structure: "syslog_text",
        keywords: ["different_kw"]
      }
    }
  ];

  const eventEnvelope = {
    raw: {
      immutable_payload: "TEST_LOG: common_kw sample log message"
    }
  };

  const resultResolved = resolve(eventEnvelope, { parsers: mockParsers });
  assert.equal(resultResolved.status, "RESOLVED");
  assert.equal(resultResolved.parserId, "parser_a");

  const ambiguousParsers = [
    {
      parser_id: "parser_x",
      detection: {
        signatures: ["AMBIGUOUS_PATTERN"],
        structure: "syslog_text"
      }
    },
    {
      parser_id: "parser_y",
      detection: {
        signatures: ["AMBIGUOUS_PATTERN"],
        structure: "syslog_text"
      }
    }
  ];

  const resultAmbiguous = resolve({ raw: { immutable_payload: "AMBIGUOUS_PATTERN: sample line" } }, { parsers: ambiguousParsers });
  assert.equal(resultAmbiguous.status, "AMBIGUOUS");
  assert.equal(resultAmbiguous.confidence, 0.75);
});

test("Source Resolver - String input / Invalid payload handling", () => {
  const resStr = resolve("%ASA-6-302013: Built inbound TCP connection");
  assert.equal(resStr.status, "RESOLVED");
  assert.equal(resStr.parserId, "cisco_asa_v1.0");

  const resEmpty = resolve(null);
  assert.equal(resEmpty.status, "UNKNOWN");
  assert.equal(resEmpty.parserId, null);
  assert.equal(resEmpty.confidence, 0);
});
