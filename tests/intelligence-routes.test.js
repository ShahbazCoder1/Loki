import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
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
        ]
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
  }
});
