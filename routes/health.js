import express from "express";
import { client } from "../modules/exporter.js";
import { getLoadedParsers } from "../modules/parser-manager.js";

export function createHealthRouter({ esClient = client } = {}) {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    const parsersLoaded = getLoadedParsers().length;
    try {
      await esClient.ping();

      return res.json({
        status: "ok",
        elasticsearch: "connected",
        parsers_loaded: parsersLoaded
      });
    } catch (_error) {
      return res.status(503).json({
        status: "error",
        elasticsearch: "disconnected",
        parsers_loaded: parsersLoaded
      });
    }
  });

  return router;
}

export default createHealthRouter();
