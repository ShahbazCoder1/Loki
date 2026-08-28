import express from "express";
import cors from "cors";

import logsRouter from "./routes/logs.js";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/logs", logsRouter);

app.listen(PORT, () => {
  console.log(`ULPF Prototype running on http://localhost:${PORT}`);
});