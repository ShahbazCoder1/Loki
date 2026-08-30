import express from "express";
import { client } from "../modules/exporter.js";

const router = express.Router();

function responseSource(response) {
  return response?._source || response?.body?._source || null;
}

// GET /api/events/:event_id/lineage
router.get("/:event_id/lineage", async (req, res) => {
  try {
    const response = await client.get({ index: "ulpf-events", id: req.params.event_id });
    const event = responseSource(response);
    if (!event) return res.status(404).json({ error: "Event not found" });

    return res.json({
      event_id: event.event_id || req.params.event_id,
      field_lineage: event.field_lineage || {},
      provenance: event.provenance || []
    });
  } catch (error) {
    if (error.meta?.statusCode === 404 || error.statusCode === 404) {
      return res.status(404).json({ error: "Event not found" });
    }
    console.error("Error retrieving event lineage:", error);
    return res.status(503).json({ error: "Unable to retrieve event lineage" });
  }
});

export default router;
