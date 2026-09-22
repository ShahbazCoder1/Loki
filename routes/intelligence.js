import express from "express";
import {
  clusterQuarantinedEvents,
  generateCandidateParser,
  testCandidate,
  activateCandidate,
  analyzeSecurityQuestion
} from "../modules/intelligence.js";


const router = express.Router();

// In-memory store for pending candidates
const pendingCandidates = new Map();

// 1. GET /api/intelligence/candidates
router.get("/candidates", async (_req, res) => {
  try {
    const candidates = Array.from(pendingCandidates.values());
    return res.json({
      status: "success",
      total_candidates: candidates.length,
      candidates
    });
  } catch (error) {
    console.error("Error retrieving candidates:", error);
    return res.status(500).json({ error: "Failed to retrieve candidates" });
  }
});


// 1c. GET /api/intelligence/review/:cluster_id
router.get("/review/:cluster_id", async (req, res) => {
  try {
    const { cluster_id } = req.params;

    if (pendingCandidates.has(cluster_id)) {
      return res.json({ status: "success", candidate: pendingCandidates.get(cluster_id) });
    }

    const clusters = await clusterQuarantinedEvents({ useSampleFallbacks: true });
    const cluster = clusters.find(c => c.cluster_id === cluster_id || c.fingerprint_hash === cluster_id);

    if (!cluster) {
      return res.status(404).json({ error: "Cluster not found" });
    }

    const candidate = await generateCandidateParser(cluster, {
      timeout: Number(process.env.OLLAMA_TIMEOUT_MS) || 120000
    });
    const testRes = testCandidate(candidate, cluster.samples || [], []);

    const candidate_id = candidate.parser_id || `candidate_${cluster.cluster_id.substring(0, 8)}`;
    const candidateRecord = {
      candidate_id,
      cluster_id: cluster.cluster_id,
      device_family: candidate.device_family || "Unknown Device",
      cluster_size: cluster.count || (cluster.samples ? cluster.samples.length : 1),
      candidate,
      test_results: testRes,
      status: "pending"
    };

    pendingCandidates.set(cluster_id, candidateRecord);

    return res.json({
      status: "success",
      candidate: candidateRecord
    });
  } catch (error) {
    console.error("Error generating parser on-demand:", error.message);
    const statusCode = (error.ollama_status === "offline" || error.ollama_status === "timeout") ? 503 : 500;
    return res.status(statusCode).json({
      error: error.message || "Failed to generate candidate parser",
      ollama_status: error.ollama_status || "error"
    });
  }
});

// 2. POST /api/intelligence/cluster
router.post("/cluster", async (req, res) => {
  try {
    const options = {
      useSampleFallbacks: req.body?.useSampleFallbacks ?? true,
      events: req.body?.events,
      quarantineDir: req.body?.quarantineDir
    };

    const clusters = await clusterQuarantinedEvents(options);
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

// 3. POST /api/intelligence/generate
router.post("/generate", async (req, res) => {
  try {
    const { cluster_id, samples, template, options } = req.body || {};

    let targetCluster = null;

    if (samples && Array.isArray(samples) && samples.length > 0) {
      targetCluster = {
        cluster_id: cluster_id || "manual_cluster",
        template: template || "",
        samples
      };
    } else if (cluster_id) {
      const clusters = await clusterQuarantinedEvents({ useSampleFallbacks: true });
      targetCluster = clusters.find(c => c.cluster_id === cluster_id || c.fingerprint_hash === cluster_id);
    }

    if (!targetCluster) {
      const clusters = await clusterQuarantinedEvents({ useSampleFallbacks: true });
      if (clusters.length > 0) {
        targetCluster = clusters[0];
      }
    }

    if (!targetCluster) {
      return res.status(400).json({
        error: "No samples or valid cluster_id provided to generate parser"
      });
    }

    const candidate = await generateCandidateParser(targetCluster, {
      timeout: Number(process.env.OLLAMA_TIMEOUT_MS) || 120000,
      ...options
    });
    const testResults = testCandidate(candidate, targetCluster.samples || candidate.samples || [], []);

    const candidate_id = candidate.parser_id || `candidate_${targetCluster.cluster_id.substring(0, 8)}`;

    const candidateRecord = {
      candidate_id,
      cluster_id: targetCluster.cluster_id,
      device_family: candidate.device_family || "Unknown Device",
      cluster_size: targetCluster.count || (targetCluster.samples ? targetCluster.samples.length : 1),
      candidate,
      test_results: testResults,
      status: "pending"
    };

    pendingCandidates.set(targetCluster.cluster_id, candidateRecord);

    return res.json({
      status: "generated",
      cluster_id: targetCluster.cluster_id,
      candidate,
      candidate_record: candidateRecord
    });
  } catch (error) {
    console.error("Error generating candidate parser:", error.message);
    const statusCode = (error.ollama_status === "offline" || error.ollama_status === "timeout") ? 503 : 500;
    return res.status(statusCode).json({
      error: error.message || "Failed to generate candidate parser",
      ollama_status: error.ollama_status || "error"
    });
  }
});

// 4. POST /api/intelligence/test
router.post("/test", (req, res) => {
  try {
    let { candidate, positive_samples, negative_samples } = req.body;
    if (candidate && candidate.candidate) {
      candidate = candidate.candidate;
    }

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

// 5. POST /api/intelligence/approve
router.post("/approve", (req, res) => {
  try {
    let { candidate, candidate_id, cluster_id } = req.body || {};

    if (candidate && candidate.candidate) {
      candidate = candidate.candidate;
    }

    let targetCandidate = candidate;
    const lookupId = cluster_id || candidate_id;

    if (!targetCandidate && lookupId) {
      const record = pendingCandidates.get(lookupId);
      if (record) {
        targetCandidate = record.candidate;
      }
    }

    if (!targetCandidate || !targetCandidate.parser_id || !targetCandidate.extraction_rules) {
      return res.status(400).json({
        error: "Request body must contain a valid candidate parser object or valid cluster_id"
      });
    }

    const activation = activateCandidate(targetCandidate);
    if (lookupId) {
      pendingCandidates.delete(lookupId);
    } else if (targetCandidate.parser_id) {
      pendingCandidates.delete(targetCandidate.parser_id);
    }

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

// 6. POST /api/intelligence/reject
router.post("/reject", (req, res) => {
  try {
    const { candidate_id, cluster_id } = req.body || {};
    const lookupId = cluster_id || candidate_id;
    if (!lookupId) {
      return res.status(400).json({ error: "cluster_id or candidate_id is required for rejection" });
    }

    pendingCandidates.delete(lookupId);

    return res.json({
      status: "rejected",
      cluster_id: lookupId,
      message: `Candidate for cluster '${lookupId}' has been rejected.`
    });
  } catch (error) {
    console.error("Error rejecting candidate:", error);
    return res.status(500).json({ error: "Failed to reject candidate parser" });
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

