import express from "express";
import { client } from "../modules/exporter.js";
import { getLoadedParsers } from "../modules/parser-manager.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const parsersLoaded = getLoadedParsers().length;
  try {
    await client.ping();

    res.json({
      status: "ok",
      elasticsearch: "connected",
      parsers_loaded: parsersLoaded
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      elasticsearch: "disconnected",
      parsers_loaded: parsersLoaded
    });
  }
});

export default router;
