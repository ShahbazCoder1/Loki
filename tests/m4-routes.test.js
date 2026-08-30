import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import parsersRouter from "../routes/parsers.js";
import eventsRouter from "../routes/events.js";
import quarantineRouter from "../routes/quarantine.js";
import healthRouter from "../routes/health.js";
import { client } from "../modules/exporter.js";

test("M4 REST endpoints return the documented response shapes", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/parsers", parsersRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api/quarantine", quarantineRouter);
  app.use("/api/health", healthRouter);

  const originalGet = client.get;
  const originalSearch = client.search;
  const originalPing = client.ping;
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const port = server.address().port;

  try {
    let response = await fetch(`http://127.0.0.1:${port}/api/parsers`);
    let body = await response.json();
    assert.equal(response.status, 200);
    assert.ok(body.count >= 3);
    assert.ok(body.parsers.every(parser => parser.parser_id && Array.isArray(parser.signatures)));

    response = await fetch(`http://127.0.0.1:${port}/api/parsers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yaml_content: "parser_id: incomplete" })
    });
    assert.equal(response.status, 400);

    client.get = async () => ({
      _source: {
        event_id: "event-1",
        field_lineage: { action: { parsed_field: "action" } },
        provenance: [{ stage: "normalize" }]
      }
    });
    response = await fetch(`http://127.0.0.1:${port}/api/events/event-1/lineage`);
    body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.event_id, "event-1");
    assert.equal(body.field_lineage.action.parsed_field, "action");

    client.search = async () => ({
      hits: {
        hits: [{
          _id: "quarantine-1",
          _source: {
            event_id: "quarantine-1",
            received_at: "2026-08-30T10:00:00.000Z",
            quarantined_at: "2026-08-30T10:00:01.000Z",
            quarantine_reason: "Unknown log format",
            raw: { immutable_payload: "CUSTOM src=10.0.0.1 action=allow" }
          }
        }]
      }
    });
    response = await fetch(`http://127.0.0.1:${port}/api/quarantine`);
    body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.events[0].event_id, "quarantine-1");

    response = await fetch(`http://127.0.0.1:${port}/api/quarantine/clusters`);
    body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.clusters[0].count, 1);

    client.ping = async () => true;
    response = await fetch(`http://127.0.0.1:${port}/api/health`);
    body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.ok(body.parsers_loaded >= 3);
  } finally {
    client.get = originalGet;
    client.search = originalSearch;
    client.ping = originalPing;
    await new Promise(resolve => server.close(resolve));
  }
});
