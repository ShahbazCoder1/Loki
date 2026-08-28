import express from "express";
import { receive } from "../modules/receiver.js";

const router = express.Router();

// POST /api/logs
router.post("/", (req, res) => {
  const { raw } = req.body;

  // Validate request body
  if (!raw || typeof raw !== "string") {
    return res.status(400).json({
      error: "Request body must contain a raw log string"
    });
  }

  try {
    const event = receive(raw);

    return res.status(201).json(event);
  } catch (error) {
    console.error("Error receiving log:", error);

    return res.status(500).json({
      error: "Failed to process log"
    });
  }
});

export default router;