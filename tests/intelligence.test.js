import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import YAML from "yaml";
import {
  fingerprint,
  clusterQuarantinedEvents,
  generateCandidateParser,
  testCandidate,
  activateCandidate
} from "../modules/intelligence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test("Intelligence Plane - Fingerprinting variables to template", () => {
  const log1 = "2026-08-25 10:10:01 SRC=10.0.0.5 DST=192.168.1.2 PORT=443";
  const log2 = "2026-08-25 11:22:33 SRC=172.16.0.99 DST=10.10.1.1 PORT=80";

  const fp1 = fingerprint(log1);
  const fp2 = fingerprint(log2);

  assert.equal(fp1.template, "<timestamp> SRC=<ip> DST=<ip> PORT=<port>");
  assert.equal(fp2.template, "<timestamp> SRC=<ip> DST=<ip> PORT=<port>");
  assert.equal(fp1.hash, fp2.hash, "Logs with identical structure must share the same structural fingerprint hash");
});

test("Intelligence Plane - Clustering quarantined events", async () => {
  const mockEvents = [
    { raw: { immutable_payload: "Aug 25 10:00:00 juniper-srx RT_FLOW: session created 10.0.0.5/1234->192.168.1.1/443" } },
    { raw: { immutable_payload: "Aug 25 10:01:00 juniper-srx RT_FLOW: session created 10.0.0.99/5555->172.16.1.1/80" } },
    { raw: { immutable_payload: "Aug 25 10:02:00 web-server-01 sshd[123]: Failed password for root from 198.51.100.22 port 51234" } }
  ];

  const clusters = await clusterQuarantinedEvents({ events: mockEvents });

  assert.equal(clusters.length, 2, "Should form exactly 2 distinct structural clusters");
  assert.equal(clusters[0].count, 2, "Top cluster should have count of 2");
  assert.equal(clusters[0].samples.length, 2);
  assert.equal(clusters[1].count, 1);
});

test("Intelligence Plane - Candidate parser generation and testing", async () => {
  const mockOllama = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      response: JSON.stringify({
        parser_id: "juniper_srx_v1.0",
        version: "1.0",
        device_family: "Juniper SRX",
        description: "Auto-generated parser for Juniper SRX",
        detection: {
          signatures: ["RT_FLOW:"],
          structure: "syslog_text",
          keywords: ["RT_FLOW:"]
        },
        extraction_rules: [
          { field: "event_type", regex: "(RT_FLOW_SESSION_[A-Z_]+)" },
          { field: "src_ip", regex: "(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})/\\d+->" },
          { field: "src_port", regex: "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/(\\d+)->" },
          { field: "dst_ip", regex: "->(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})/\\d+" },
          { field: "dst_port", regex: "->\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/(\\d+)" }
        ],
        required_fields: ["src_ip", "dst_ip", "event_type"],
        normalization_mapping: {
          src_ip: "src_endpoint.ip",
          dst_ip: "dst_endpoint.ip",
          src_port: "src_endpoint.port",
          dst_port: "dst_endpoint.port",
          event_type: "event_type"
        }
      })
    }));
  });

  await new Promise(resolve => mockOllama.listen(0, resolve));
  const port = mockOllama.address().port;

  try {
    const cluster = {
      cluster_id: "test_juniper_cluster",
      template: "juniper-srx RT_FLOW: session created <ip>/<port>-><ip>/<port>",
      samples: [
        "Aug 25 10:00:00 juniper-srx RT_FLOW: RT_FLOW_SESSION_CREATE: session created 10.0.0.5/1234->192.168.1.1/443 junos-https 6 trust untrust",
        "Aug 25 10:01:00 juniper-srx RT_FLOW: RT_FLOW_SESSION_CREATE: session created 10.0.0.99/5555->172.16.1.1/80 junos-http 6 trust untrust"
      ]
    };

    const candidate = await generateCandidateParser(cluster, {
      ollamaUrl: `http://127.0.0.1:${port}/api/generate`
    });

    assert.ok(candidate.parser_id, "Candidate must have a parser_id");
    assert.ok(candidate.detection?.signatures?.length > 0, "Candidate must have detection signatures");
    assert.ok(candidate.extraction_rules?.length > 0, "Candidate must have extraction rules");
    assert.ok(candidate.normalization_mapping, "Candidate must have normalization mappings");

    // Negative test samples that should NOT match Juniper
    const negativeSamples = [
      "%ASA-6-302013: Built inbound TCP connection 12345 for outside:10.0.0.5/1234 to inside:192.168.1.1/443",
      "date=2026-08-25 time=10:00:00 devname=FGT60E logid=0000000013 type=traffic action=accept srcip=10.0.0.5 dstip=192.168.1.1",
      "CEF:0|Palo Alto|Firewall|10.0|100|Connection Allowed|3|src=10.0.0.5 dst=192.168.1.1 dpt=443 act=allow"
    ];

    const testResults = testCandidate(candidate, cluster.samples, negativeSamples);

    assert.equal(testResults.overall_pass, true, "Candidate must pass automated testing");
    assert.equal(testResults.positive.passed, 2, "Both positive samples must be extracted");
    assert.equal(testResults.negative.correctly_rejected, 3, "All 3 unrelated logs must be rejected");
  } finally {
    mockOllama.close();
  }
});

test("Intelligence Plane - Candidate parser generation throws on offline Ollama", async () => {
  await assert.rejects(
    async () => {
      await generateCandidateParser(
        { samples: ["Aug 25 10:00:00 test-log"] },
        { ollamaUrl: "http://127.0.0.1:59999/api/generate", timeout: 1000 }
      );
    },
    (err) => {
      assert.ok(err.ollama_status === "offline" || err.ollama_status === "timeout");
      return true;
    }
  );
});

test("Intelligence Plane - Activation creates loadable YAML parser", () => {
  const tempDir = path.join(__dirname, "tmp_test_parsers");
  const candidate = {
    parser_id: "test_auto_device_v1.0",
    version: "1.0",
    device_family: "Test Device",
    description: "Temporary unit test parser",
    detection: {
      signatures: ["TEST_AUTO_SIG"],
      structure: "syslog_text",
      keywords: ["TEST_AUTO_SIG"]
    },
    extraction_rules: [
      { field: "src_ip", regex: "src=(\\d+\\.\\d+\\.\\d+\\.\\d+)" }
    ],
    required_fields: ["src_ip"],
    normalization_mapping: {
      src_ip: "src_endpoint.ip"
    }
  };

  const activation = activateCandidate(candidate, tempDir);
  assert.equal(activation.success, true);
  assert.ok(fs.existsSync(activation.file_path));

  // Verify file parses cleanly
  const loaded = YAML.parse(fs.readFileSync(activation.file_path, "utf-8"));
  assert.equal(loaded.parser_id, "test_auto_device_v1.0");
  assert.equal(loaded.detection.signatures[0], "TEST_AUTO_SIG");

  // Clean up isolated test dir
  fs.rmSync(tempDir, { recursive: true, force: true });
});
