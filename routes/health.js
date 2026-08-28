import express from "express";
import { client } from "../modules/exporter.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    await client.ping();

    res.json({
      status: "ok",
      elasticsearch: "connected",
      parsers_loaded: 3
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      elasticsearch: "disconnected",
      parsers_loaded: 3
    });
  }
});

export default router;