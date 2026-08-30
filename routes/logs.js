import express from "express";
import { processLogPipeline } from "../modules/pipeline.js";

const router = express.Router();

// POST /api/logs
router.post("/", async (req, res) => {
  const { raw } = req.body;

  // Validate request body
  if (!raw || typeof raw !== "string") {
    return res.status(400).json({
      error: "Request body must contain a raw log string"
    });
  }

  try {
    const result = await processLogPipeline(raw);

    if (result.status === "quarantined") {
      return res.status(200).json({
        status: "quarantined",
        reason: result.reason,
        event_id: result.event_id,
        resolution: result.resolution,
        event: result.event
      });
    }

    if (result.status === "dead-letter") {
      return res.status(200).json({
        status: "dead-letter",
        reason: result.reason,
        event_id: result.event_id,
        parseResult: result.parseResult,
        event: result.event
      });
    }

    return res.status(200).json({
      status: "exported",
      event_id: result.event_id,
      resolution: result.resolution,
      parseResult: result.parseResult,
      normalized: result.normResult?.normalizedFields,
      event: result.event
    });
  } catch (error) {
    console.error("Error processing log pipeline:", error);

    return res.status(500).json({
      error: "Failed to process log"
    });
  }
});

export default router;
