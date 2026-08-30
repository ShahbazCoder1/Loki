import express from "express";
import { client } from "../modules/exporter.js";
import { clusterQuarantinedEvents } from "../modules/intelligence.js";

const router = express.Router();

function hitsFrom(response) {
  return response?.hits?.hits || response?.body?.hits?.hits || [];
}

function limitFrom(value) {
  const limit = Number.parseInt(value, 10);
  return Number.isInteger(limit) ? Math.max(1, Math.min(limit, 100)) : 50;
}

async function getQuarantinedDocuments(limit) {
  const response = await client.search({
    index: "ulpf-quarantine",
    size: limit,
    sort: [{ quarantined_at: { order: "desc", unmapped_type: "date" } }]
  });
  return hitsFrom(response).map(hit => ({ event_id: hit._id, ...hit._source }));
}

// GET /api/quarantine
router.get("/", async (req, res) => {
  try {
    const events = await getQuarantinedDocuments(limitFrom(req.query.limit));
    return res.json({
      count: events.length,
      events: events.map(event => ({
        event_id: event.event_id,
        raw_preview: (event.raw?.immutable_payload || "").slice(0, 200),
        reason: event.quarantine_reason || "Unknown log format",
        received_at: event.received_at,
        quarantined_at: event.quarantined_at
      }))
    });
  } catch (error) {
    console.error("Error retrieving quarantined events:", error);
    return res.status(503).json({ error: "Unable to retrieve quarantined events" });
  }
});

// GET /api/quarantine/clusters
router.get("/clusters", async (req, res) => {
  try {
    const events = await getQuarantinedDocuments(limitFrom(req.query.limit));
    const clusters = clusterQuarantinedEvents({ events, useSampleFallbacks: false });
    return res.json({
      count: clusters.length,
      clusters: clusters.map(cluster => ({
        fingerprint: cluster.fingerprint_hash,
        count: cluster.count,
        sample_raw: cluster.samples[0] || "",
        first_seen: cluster.first_seen,
        last_seen: cluster.last_seen
      }))
    });
  } catch (error) {
    console.error("Error clustering quarantined events:", error);
    return res.status(503).json({ error: "Unable to retrieve quarantine clusters" });
  }
});

export { limitFrom };
export default router;
