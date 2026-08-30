import express from "express";

import { client } from "../modules/exporter.js";
import { fingerprint as structuralFingerprint } from "../modules/intelligence.js";

function hitsFromSearchResponse(response) {
  return response?.hits?.hits || response?.body?.hits?.hits || [];
}

function rawText(event) {
  return event.raw?.immutable_payload || event.raw?.payload || "";
}

function quarantineReason(event) {
  return event.quarantine_reason || event.reason || "Unknown reason";
}

function receivedAt(event) {
  return event.received_at || event.quarantined_at || null;
}

export function summarizeQuarantinedEvent(hit) {
  const event = hit?._source || {};
  return {
    event_id: event.event_id || hit?._id,
    raw_preview: rawText(event).slice(0, 200),
    reason: quarantineReason(event),
    received_at: receivedAt(event)
  };
}

export function clusterQuarantinedEvents(hits) {
  const clusters = new Map();

  for (const hit of hits) {
    const event = hit?._source || {};
    const sample = rawText(event);
    const fingerprint = event.structural_fingerprint
      || event.fingerprint_hash
      || structuralFingerprint(sample).hash
      || "unknown";
    const timestamp = receivedAt(event);
    const existing = clusters.get(fingerprint);

    if (!existing) {
      clusters.set(fingerprint, {
        fingerprint,
        count: 1,
        sample_raw: sample,
        first_seen: timestamp,
        last_seen: timestamp
      });
      continue;
    }

    existing.count += 1;
    if (timestamp && (!existing.first_seen || timestamp < existing.first_seen)) {
      existing.first_seen = timestamp;
    }
    if (timestamp && (!existing.last_seen || timestamp > existing.last_seen)) {
      existing.last_seen = timestamp;
    }
  }

  return Array.from(clusters.values()).sort((a, b) => b.count - a.count);
}

export function createQuarantineRouter({ esClient = client } = {}) {
  const router = express.Router();

  router.get("/clusters", async (_req, res) => {
    try {
      const response = await esClient.search({
        index: "ulpf-quarantine",
        size: 10000,
        sort: [{ received_at: { order: "asc", unmapped_type: "date" } }],
        query: { match_all: {} }
      });
      return res.json(clusterQuarantinedEvents(hitsFromSearchResponse(response)));
    } catch (error) {
      if (error?.meta?.statusCode === 404 || error?.statusCode === 404) {
        return res.json([]);
      }
      return res.status(503).json({
        error: "Elasticsearch is unavailable",
        details: error.message
      });
    }
  });

  router.get("/", async (_req, res) => {
    try {
      const response = await esClient.search({
        index: "ulpf-quarantine",
        size: 1000,
        sort: [{ received_at: { order: "desc", unmapped_type: "date" } }],
        query: { match_all: {} }
      });
      return res.json(hitsFromSearchResponse(response).map(summarizeQuarantinedEvent));
    } catch (error) {
      if (error?.meta?.statusCode === 404 || error?.statusCode === 404) {
        return res.json([]);
      }
      return res.status(503).json({
        error: "Elasticsearch is unavailable",
        details: error.message
      });
    }
  });

  return router;
}

export { hitsFromSearchResponse };
export default createQuarantineRouter();
