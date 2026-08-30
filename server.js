import express from "express";
import cors from "cors";

import logsRouter from "./routes/logs.js";
import healthRouter from "./routes/health.js";
import intelligenceRouter from "./routes/intelligence.js";
import parsersRouter from "./routes/parsers.js";
import eventsRouter from "./routes/events.js";
import quarantineRouter from "./routes/quarantine.js";
import { startWatcher } from "./modules/parser-manager.js";

const app = express();
const PORT = 3000;

// Initialize Hot Reload watcher for parser definitions
startWatcher();

app.use(cors());
app.use(express.json());
app.use("/api/health", healthRouter);

// Routes
app.use("/api/logs", logsRouter);
app.use("/api/intelligence", intelligenceRouter);
app.use("/api/parsers", parsersRouter);
app.use("/api/events", eventsRouter);
app.use("/api/quarantine", quarantineRouter);

app.listen(PORT, () => {
  console.log(`ULPF Prototype running on http://localhost:${PORT}`);
});
