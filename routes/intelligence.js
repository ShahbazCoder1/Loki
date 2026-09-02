import express from "express";
import {
  clusterQuarantinedEvents,
  generateCandidateParser,
  testCandidate,
  activateCandidate,
  analyzeSecurityQuestion
} from "../modules/intelligence.js";

const router = express.Router();

// 1. POST /api/intelligence/cluster
router.post("/cluster", (req, res) => {
  try {
    const options = {
      useSampleFallbacks: req.body?.useSampleFallbacks ?? true,
      events: req.body?.events,
      quarantineDir: req.body?.quarantineDir
    };

    const clusters = clusterQuarantinedEvents(options);
    const totalEvents = clusters.reduce((acc, c) => acc + c.count, 0);

    return res.json({
      status: "success",
      total_clusters: clusters.length,
      total_events: totalEvents,
      clusters
    });
  } catch (error) {
    console.error("Error clustering quarantined events:", error);
    return res.status(500).json({ error: "Failed to cluster quarantined events" });
  }
});

// 2. POST /api/intelligence/generate
router.post("/generate", async (req, res) => {
  try {
    const { cluster_id, samples, template, options } = req.body;

    let targetCluster = null;

    if (samples && Array.isArray(samples) && samples.length > 0) {
      targetCluster = {
        cluster_id: cluster_id || "manual_cluster",
        template: template || "",
        samples
      };
    } else if (cluster_id) {
      const clusters = clusterQuarantinedEvents({ useSampleFallbacks: true });
      targetCluster = clusters.find(c => c.cluster_id === cluster_id || c.fingerprint_hash === cluster_id);
    }

    if (!targetCluster) {
      // If nothing specified, pick top cluster from fallback/quarantine
      const clusters = clusterQuarantinedEvents({ useSampleFallbacks: true });
      if (clusters.length > 0) {
        targetCluster = clusters[0];
      }
    }

    if (!targetCluster) {
      return res.status(400).json({
        error: "No samples or valid cluster_id provided to generate parser"
      });
    }

    const candidate = await generateCandidateParser(targetCluster, options);

    return res.json({
      status: "generated",
      cluster_id: targetCluster.cluster_id,
      candidate
    });
  } catch (error) {
    console.error("Error generating candidate parser:", error);
    return res.status(500).json({ error: "Failed to generate candidate parser" });
  }
});

// 3. POST /api/intelligence/test
router.post("/test", (req, res) => {
  try {
    const { candidate, positive_samples, negative_samples } = req.body;

    if (!candidate || !candidate.detection || !candidate.extraction_rules) {
      return res.status(400).json({
        error: "Request body must contain a valid candidate parser object"
      });
    }

    const testResults = testCandidate(
      candidate,
      positive_samples || candidate.samples || [],
      negative_samples || []
    );

    return res.json({
      status: "tested",
      overall_pass: testResults.overall_pass,
      results: testResults
    });
  } catch (error) {
    console.error("Error testing candidate parser:", error);
    return res.status(500).json({ error: "Failed to test candidate parser" });
  }
});

// 4. POST /api/intelligence/approve
router.post("/approve", (req, res) => {
  try {
    const { candidate } = req.body;

    if (!candidate || !candidate.parser_id || !candidate.extraction_rules) {
      return res.status(400).json({
        error: "Request body must contain a valid candidate parser object with parser_id"
      });
    }

    const activation = activateCandidate(candidate);

    return res.status(201).json({
      status: "activated",
      parser_id: activation.parser_id,
      file_path: activation.file_path,
      message: `Parser '${activation.parser_id}' has been approved and activated.`
    });
  } catch (error) {
    console.error("Error activating parser:", error);
    return res.status(500).json({ error: "Failed to activate candidate parser" });
  }
});

// 5. POST /api/intelligence/analyze
router.post("/analyze", async (req, res) => {
  try {
    const { question, model, options } = req.body || {};

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        error: "Question parameter is required and cannot be empty"
      });
    }

    const result = await analyzeSecurityQuestion(question, { model, ...options });

    return res.json(result);
  } catch (error) {
    console.error("Error analyzing security question:", error.message);

    const isOffline = error.message.includes("Ollama service is not running") || error.message.includes("ECONNREFUSED");
    const isTimeout = error.message.includes("timed out");
    const statusCode = isOffline || isTimeout ? 503 : 500;

    return res.status(statusCode).json({
      error: error.message || "Failed to process question",
      ollama_status: isOffline ? "offline" : isTimeout ? "timeout" : "error"
    });
  }
});

// 6. GET /api/intelligence/status
router.get("/status", async (_req, res) => {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    if (response.ok) {
      const data = await response.json();
      return res.json({
        ollama_status: "online",
        models: (data.models || []).map(m => m.name)
      });
    }
    return res.json({ ollama_status: "offline", error: "Ollama returned non-200 status" });
  } catch (_err) {
    return res.json({ ollama_status: "offline", error: "Ollama service is unreachable at http://localhost:11434" });
  }
});

export default router;

