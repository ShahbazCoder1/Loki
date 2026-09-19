import express from "express";

import { client } from "../modules/exporter.js";

function sourceFromGetResponse(response) {
  return response?._source || response?.body?._source || null;
}

export function createEventsRouter({ esClient = client } = {}) {
  const router = express.Router();

  router.get("/:event_id/lineage", async (req, res) => {
    try {
      const response = await esClient.get({
        index: "ulpf-events",
        id: req.params.event_id
      });
      const event = sourceFromGetResponse(response);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      return res.json({
        event_id: event.event_id || req.params.event_id,
        field_lineage: event.field_lineage || {}
      });
    } catch (error) {
      if (error?.meta?.statusCode === 404 || error?.statusCode === 404) {
        return res.status(404).json({ error: "Event not found" });
      }

      return res.status(503).json({
        error: "Elasticsearch is unavailable",
        details: error.message
      });
    }
  });

  router.get("/:event_id/full", async (req, res) => {
    try {
      const response = await esClient.get({
        index: "ulpf-events",
        id: req.params.event_id
      });
      const event = sourceFromGetResponse(response);

      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      return res.json(event);
    } catch (error) {
      if (error?.meta?.statusCode === 404 || error?.statusCode === 404) {
        return res.status(404).json({ error: "Event not found" });
      }

      return res.status(503).json({
        error: "Elasticsearch is unavailable",
        details: error.message
      });
    }
  });

  return router;
}

export { sourceFromGetResponse };
export default createEventsRouter();
