import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import intelligenceRouter from "../routes/intelligence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/intelligence", intelligenceRouter);
  return app;
}

test("Intelligence Routes - POST /api/intelligence/cluster", async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/intelligence/cluster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useSampleFallbacks: true })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, "success");
    assert.ok(data.total_clusters > 0);
    assert.ok(Array.isArray(data.clusters));
  } finally {
    server.close();
  }
});

test("Intelligence Routes - POST /api/intelligence/generate, /test, and /approve workflow", async () => {
  const mockOllama = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      response: JSON.stringify({
        parser_id: "route_test_juniper_v1.0",
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
  const mockPort = mockOllama.address().port;

  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    // 1. Generate candidate
    const genRes = await fetch(`http://127.0.0.1:${port}/api/intelligence/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        samples: [
          "Aug 25 10:00:00 juniper-srx RT_FLOW: RT_FLOW_SESSION_CREATE: session created 10.0.0.5/1234->192.168.1.1/443 junos-https 6 trust untrust"
        ],
        options: {
          ollamaUrl: `http://127.0.0.1:${mockPort}/api/generate`
        }
      })
    });

    assert.equal(genRes.status, 200);
    const genData = await genRes.json();
    assert.equal(genData.status, "generated");
    assert.ok(genData.candidate);

    const candidate = genData.candidate;

    // 2. Test candidate
    const testRes = await fetch(`http://127.0.0.1:${port}/api/intelligence/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidate,
        positive_samples: [
          "Aug 25 10:00:00 juniper-srx RT_FLOW: RT_FLOW_SESSION_CREATE: session created 10.0.0.5/1234->192.168.1.1/443 junos-https 6 trust untrust"
        ]
      })
    });

    assert.equal(testRes.status, 200);
    const testData = await testRes.json();
    assert.equal(testData.status, "tested");
    assert.equal(testData.overall_pass, true);

    // 3. Approve candidate (custom isolated id for test)
    candidate.parser_id = "route_test_juniper_v1.0";
    const approveRes = await fetch(`http://127.0.0.1:${port}/api/intelligence/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate })
    });

    assert.equal(approveRes.status, 201);
    const approveData = await approveRes.json();
    assert.equal(approveData.status, "activated");
    assert.ok(fs.existsSync(approveData.file_path));

    // Clean up activated file
    fs.unlinkSync(approveData.file_path);
  } finally {
    server.close();
    mockOllama.close();
  }
});

test("Intelligence Routes - POST /api/intelligence/generate returns 503 when Ollama is offline", async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/intelligence/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        samples: ["Aug 25 10:00:00 test log"],
        options: {
          ollamaUrl: "http://127.0.0.1:59999/api/generate",
          timeout: 1000
        }
      })
    });

    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.ollama_status, "offline");
    assert.ok(data.error.includes("Ollama AI service is not running"));
  } finally {
    server.close();
  }
});
