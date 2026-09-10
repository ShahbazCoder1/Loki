import express from "express";
import bus from "../modules/event-bus.js";

export function createStreamRouter() {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const listener = (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    bus.on("event", listener);

    req.on("close", () => {
      bus.off("event", listener);
    });
  });

  return router;
}