import express from "express";
import { processLogPipeline } from "../modules/pipeline.js";


const router = express.Router();

router.post("/", async (req, res) => {
  const { raw } = req.body;

  if (!raw || typeof raw !== "string") {
    return res.status(400).json({
      error: "Request body must contain a raw log string"
    });
  }

  try {
    const result = await processLogPipeline(raw);

    return res.status(200).json({
      status: result.status,
      event_id: result.event_id,
      ...(result.reason ? { reason: result.reason } : {}),
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
