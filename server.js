import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";

import logsRouter from "./routes/logs.js";
import { createHealthRouter } from "./routes/health.js";
import intelligenceRouter from "./routes/intelligence.js";
import { createParsersRouter } from "./routes/parsers.js";
import { createEventsRouter } from "./routes/events.js";
import { createQuarantineRouter } from "./routes/quarantine.js";
import { client } from "./modules/exporter.js";
import { startWatcher } from "./modules/parser-manager.js";

export function createApp({ esClient = client, parsersDir } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", createHealthRouter({ esClient }));
  app.use("/api/logs", logsRouter);
  app.use("/api/intelligence", intelligenceRouter);
  app.use("/api/parsers", createParsersRouter({ parsersDir }));
  app.use("/api/events", createEventsRouter({ esClient }));
  app.use("/api/quarantine", createQuarantineRouter({ esClient }));

  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
  app.use((error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Request body contains invalid JSON" });
    }
    if (error?.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body exceeds the 1 MB limit" });
    }
    res.status(500).json({ error: "Internal server error", details: error.message });
  });

  return app;
}

export function startServer({ port = Number(process.env.PORT || 3000) } = {}) {
  startWatcher();
  return createApp().listen(port, () => {
    console.log(`ULPF Prototype running on http://localhost:${port}`);
  });
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) startServer();
