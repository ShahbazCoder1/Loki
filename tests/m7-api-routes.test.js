import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

import { createApp } from "../server.js";
import { resetParsersCache } from "../modules/parser-manager.js";

const lineage = {
  "src_endpoint.ip": {
    raw_fragment: "10.0.0.5",
    parsed_field: "src_ip",
    extraction_rule: "src=(\\S+)",
    parser: "test_v1",
    parser_version: "1.0",
    mapping_rule: "src_ip -> src_endpoint.ip"
  }
};

const quarantineHits = [
  {
    _id: "event-1",
    _source: {
      event_id: "event-1",
      content_fingerprint: "fingerprint-a",
      structural_fingerprint: "fingerprint-a",
      raw: { immutable_payload: "A".repeat(220) },
      quarantine_reason: "Unknown log format",
      received_at: "2026-08-30T10:00:00.000Z"
    }
  },
  {
    _id: "event-2",
    _source: {
      event_id: "event-2",
      content_fingerprint: "fingerprint-a",
      structural_fingerprint: "fingerprint-a",
      raw: { immutable_payload: "second sample" },
      quarantine_reason: "Unknown log format",
      received_at: "2026-08-30T11:00:00.000Z"
    }
  },
  {
    _id: "event-3",
    _source: {
      event_id: "event-3",
      content_fingerprint: "fingerprint-b",
      structural_fingerprint: "fingerprint-b",
      raw: { immutable_payload: "third sample" },
      quarantine_reason: "Ambiguous source resolution",
      received_at: "2026-08-30T09:00:00.000Z"
    }
  }
];

const fakeEsClient = {
  async ping() {
    return true;
  },
  async get({ id }) {
    if (id === "missing") {
      const error = new Error("not found");
      error.meta = { statusCode: 404 };
      throw error;
    }
    return { _source: { event_id: id, field_lineage: lineage } };
  },
  async search() {
    return { hits: { hits: quarantineHits } };
  }
};

let parsersDir;
let server;
let baseUrl;

const initialParser = `
parser_id: route_test_v1
version: "1.0"
device_family: Route Test
detection:
  signatures: ["ROUTE_TEST"]
extraction_rules:
  - field: action
    regex: "action=(\\\\w+)"
`;

function uploadYaml(parserId) {
  return `
parser_id: ${parserId}
version: "1.0"
device_family: Uploaded Test
detection:
  signatures: ["UPLOADED_TEST"]
extraction_rules:
  - field: action
    regex: "action=(\\\\w+)"
`;
}

before(async () => {
  parsersDir = fs.mkdtempSync(path.join(os.tmpdir(), "ulpf-parsers-"));
  fs.writeFileSync(path.join(parsersDir, "route_test_v1.yaml"), initialParser, "utf8");
  resetParsersCache();

  const app = createApp({ esClient: fakeEsClient, parsersDir });
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  resetParsersCache();
  fs.rmSync(parsersDir, { recursive: true, force: true });
});

test("GET /api/health returns clean service status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body).sort(), ["elasticsearch", "parsers_loaded", "status"]);
  assert.equal(body.status, "ok");
  assert.equal(body.elasticsearch, "connected");
});

test("GET /api/parsers returns loaded parser summaries", async () => {
  const response = await fetch(`${baseUrl}/api/parsers`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.length, 1);
  assert.deepEqual(body[0], {
    parser_id: "route_test_v1",
    version: "1.0",
    device_family: "Route Test",
    status: "loaded",
    signatures: ["ROUTE_TEST"]
  });
});

test("POST /api/parsers accepts JSON YAML and hot-loads it", async () => {
  const response = await fetch(`${baseUrl}/api/parsers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ yaml_content: uploadYaml("json_upload_v1") })
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.parser.parser_id, "json_upload_v1");

  const list = await (await fetch(`${baseUrl}/api/parsers`)).json();
  assert.ok(list.some(parser => parser.parser_id === "json_upload_v1"));
});

test("POST /api/parsers accepts multipart file uploads", async () => {
  const form = new FormData();
  form.append("file", new Blob([uploadYaml("multipart_upload_v1")], { type: "application/yaml" }), "parser.yaml");

  const response = await fetch(`${baseUrl}/api/parsers`, { method: "POST", body: form });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.parser.parser_id, "multipart_upload_v1");
});

test("POST /api/parsers rejects malformed parser definitions", async () => {
  const response = await fetch(`${baseUrl}/api/parsers`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ yaml_content: "parser_id: ../../unsafe" })
  });
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.error, "Invalid parser definition");
});

test("GET /api/events/:event_id/lineage returns field lineage", async () => {
  const response = await fetch(`${baseUrl}/api/events/event-123/lineage`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { event_id: "event-123", field_lineage: lineage });

  const missing = await fetch(`${baseUrl}/api/events/missing/lineage`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "Event not found" });
});

test("GET /api/quarantine returns clean summaries with 200-character previews", async () => {
  const response = await fetch(`${baseUrl}/api/quarantine`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.length, 3);
  assert.equal(body[0].raw_preview.length, 200);
  assert.deepEqual(Object.keys(body[0]).sort(), ["event_id", "raw_preview", "reason", "received_at"]);
});

test("GET /api/quarantine/clusters groups structural fingerprints", async () => {
  const response = await fetch(`${baseUrl}/api/quarantine/clusters`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.length, 2);
  assert.deepEqual(body[0], {
    fingerprint: "fingerprint-a",
    count: 2,
    sample_raw: "A".repeat(220),
    first_seen: "2026-08-30T10:00:00.000Z",
    last_seen: "2026-08-30T11:00:00.000Z"
  });
});

test("unknown API routes return JSON 404 responses", async () => {
  const response = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Route not found" });
});

test("GET /trace/:event_id returns public/trace.html", async () => {
  const response = await fetch(`${baseUrl}/trace/event-123`);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("content-type")?.includes("text/html"));
  const html = await response.text();
  assert.ok(html.includes("<title>ULPF Event Trace</title>"));
});

test("GET /review/:cluster_id returns public/cluster-review.html", async () => {
  const response = await fetch(`${baseUrl}/review/cluster-123`);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("content-type")?.includes("text/html"));
  const html = await response.text();
  assert.ok(html.includes("<title>ULPF Parser Action</title>"));
});

test("POST /api/logs validates input and returns clean JSON errors", async () => {
  const response = await fetch(`${baseUrl}/api/logs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ raw: 123 })
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Request body must contain a raw log string"
  });
});
