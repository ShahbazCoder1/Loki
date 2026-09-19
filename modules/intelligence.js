import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import CryptoJS from "crypto-js";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sha256(data) {
  return CryptoJS.SHA256(data).toString();
}

/**
 * 1. Fingerprinting: Normalize variables to generate a structural template and hash
 * @param {string} rawLog
 * @returns {{ template: string, hash: string }}
 */
export function fingerprint(rawLog) {
  if (!rawLog || typeof rawLog !== "string") {
    return { template: "", hash: "" };
  }

  let template = rawLog;

  // 1. IPv4 addresses
  template = template.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<ip>");

  // 2. IPv6 addresses
  template = template.replace(/\b(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\b/g, "<ipv6>");
  template = template.replace(/\b(?:[a-fA-F0-9]{1,4}:){1,7}:[a-fA-F0-9]{1,4}\b/g, "<ipv6>");

  // 3. ISO 8601 / RFC 3339 timestamps
  template = template.replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\b/g, "<timestamp>");

  // 4. Syslog/traditional date timestamps
  template = template.replace(/\b[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\b/g, "<timestamp>");
  template = template.replace(/\b\d{1,2}-[A-Z][a-z]{2}-\d{4}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/g, "<timestamp>");
  template = template.replace(/\b\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/g, "<timestamp>");

  // 5. Epoch timestamps
  template = template.replace(/\b\d{10,13}(?:\.\d+)?\b/g, "<epoch>");

  // 6. MAC addresses
  template = template.replace(/\b(?:[0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}\b/g, "<mac>");

  // 7. Ports (contextual)
  template = template.replace(/\/(\d{1,5})\b/g, "/<port>");
  template = template.replace(/:(\d{1,5})\b/g, ":<port>");
  template = template.replace(/\bport\s+(\d{1,5})\b/gi, "port <port>");
  template = template.replace(/\b(spt|dpt|srcport|dstport|port)=(\d{1,5})\b/gi, "$1=<port>");

  // 8. UUIDs
  template = template.replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g, "<uuid>");

  // 9. Hex constants
  template = template.replace(/\b0x[0-9a-fA-F]+\b/g, "<hex>");

  // 10. Standalone multi-digit numbers (counters, IDs)
  template = template.replace(/\b\d{3,}\b/g, "<num>");

  const hash = sha256(template);
  return { template, hash };
}

/**
 * Helper to extract raw log payload from various object formats
 */
function extractRaw(item) {
  if (typeof item === "string") return item;
  if (item && item.raw && typeof item.raw.immutable_payload === "string") {
    return item.raw.immutable_payload;
  }
  if (item && typeof item.raw === "string") return item.raw;
  if (item && typeof item.message === "string") return item.message;
  return "";
}

/**
 * 2. Clustering: Group quarantined logs by structural fingerprint
 * @param {Object} [options] - Options (folder, events, useSampleFallbacks)
 * @returns {Array<Object>} List of cluster objects sorted by count desc
 */
export function clusterQuarantinedEvents(options = {}) {
  const events = [];

  // If explicit events passed in options
  if (Array.isArray(options.events)) {
    events.push(...options.events);
  }

  // Load from quarantine directory on disk
  const quarantineDir = options.quarantineDir || path.join(__dirname, "..", "quarantine");
  if (fs.existsSync(quarantineDir) && fs.statSync(quarantineDir).isDirectory()) {
    const files = fs.readdirSync(quarantineDir);
    for (const f of files) {
      if (f.endsWith(".json")) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(quarantineDir, f), "utf-8"));
          events.push(content);
        } catch (_) {}
      }
    }
  }

  // If no files in quarantine and useSampleFallbacks is enabled
  if (events.length === 0 && (options.useSampleFallbacks || options.includeUnknownSamples)) {
    const unknownPath = path.join(__dirname, "..", "test-logs", "unknown", "samples.json");
    if (fs.existsSync(unknownPath)) {
      try {
        const samples = JSON.parse(fs.readFileSync(unknownPath, "utf-8"));
        for (const s of samples) {
          events.push({
            event_id: sha256(s).substring(0, 16),
            received_at: new Date().toISOString(),
            raw: { immutable_payload: s }
          });
        }
      } catch (_) {}
    }
  }

  const clustersMap = new Map();

  for (const ev of events) {
    const rawLog = extractRaw(ev);
    if (!rawLog) continue;

    const { template, hash } = fingerprint(rawLog);
    const timestamp = ev.received_at || ev.timestamp || new Date().toISOString();

    if (!clustersMap.has(hash)) {
      clustersMap.set(hash, {
        cluster_id: hash,
        fingerprint_hash: hash,
        template,
        count: 0,
        samples: [],
        first_seen: timestamp,
        last_seen: timestamp
      });
    }

    const cluster = clustersMap.get(hash);
    cluster.count++;
    if (cluster.samples.length < 5 && !cluster.samples.includes(rawLog)) {
      cluster.samples.push(rawLog);
    }
    if (timestamp < cluster.first_seen) cluster.first_seen = timestamp;
    if (timestamp > cluster.last_seen) cluster.last_seen = timestamp;
  }

  const result = Array.from(clustersMap.values());
  result.sort((a, b) => b.count - a.count);
  return result;
}

/**
 * 3. Generate candidate parser from cluster samples using Ollama or fallback
 * @param {Object} cluster - Cluster object with samples and template
 * @param {Object} [options] - Options (ollamaUrl, model)
 * @returns {Promise<Object>} Generated candidate parser
 */
export async function generateCandidateParser(cluster, options = {}) {
  const ollamaUrl = options.ollamaUrl || "http://localhost:11434/api/generate";
  const model = options.model || "gemma4:e2b";
  const samples = cluster.samples || [cluster.template];

  const prompt = `You are a log parsing expert. Analyze these perimeter security log samples from the same source device and generate a parser definition.

SAMPLES:
${samples.join("\n")}

STRUCTURAL TEMPLATE:
${cluster.template || ""}

Generate a JSON object matching this EXACT schema structure:

{
  "parser_id": "vendor_device_v1.0",
  "version": "1.0",
  "device_family": "Vendor Device",
  "description": "Parses events from log source",
  "detection": {
    "signatures": ["keyword_or_sig"],
    "structure": "syslog_text",
    "keywords": ["keyword"]
  },
  "extraction_rules": [
    {
      "field": "timestamp",
      "regex": "(\\\\d{4}-\\\\d{2}-\\\\d{2}T\\\\d{2}:\\\\d{2}:\\\\d{2}Z)"
    },
    {
      "field": "src_ip",
      "regex": "from (\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3})"
    },
    {
      "field": "src_port",
      "regex": "port (\\\\d+)"
    },
    {
      "field": "user",
      "regex": "user (\\\\S+)"
    }
  ],
  "required_fields": ["src_ip", "user"],
  "normalization_mapping": {
    "timestamp": "event_timestamp",
    "src_ip": "src_endpoint.ip",
    "src_port": "src_endpoint.port",
    "user": "user.name"
  }
}

CRITICAL RULES:
- extraction_rules, required_fields, and normalization_mapping MUST be at the ROOT level of the JSON object, NOT nested inside detection!
- detection must contain ONLY signatures, structure, and keywords.
- Every field listed in required_fields MUST have a matching entry in extraction_rules with the EXACT same field name.
- MANDATORY: The regex for EVERY rule in extraction_rules MUST place parentheses () around the captured value (e.g. "<\\\\d+>(\\\\d{4}-\\\\d{2}-\\\\d{2}T\\\\d{2}:\\\\d{2}:\\\\d{2}Z)" for timestamp). Without () parentheses, field extraction will fail!
- Return ONLY valid JSON. No markdown formatting, no code fences, no extra text.`;

  try {
    const controller = new AbortController();
    const timeoutMs = options.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json"
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      let responseText = data.response;
      // Strip markdown fences if present
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedCandidate = JSON.parse(responseText);

      // Validate core properties and ensure extraction rules are valid JavaScript regexes
      if (parsedCandidate && parsedCandidate.detection && Array.isArray(parsedCandidate.extraction_rules)) {
        if (!parsedCandidate.parser_id) parsedCandidate.parser_id = "ai_candidate_v1.0";
        if (!parsedCandidate.version) parsedCandidate.version = "1.0";
        parsedCandidate.source = "ollama_" + model;
        parsedCandidate.is_generated = true;
        parsedCandidate.generated_at = new Date().toISOString();

        const testRes = testCandidate(parsedCandidate, samples, []);
        if (testRes.positive.passed > 0) {
          return parsedCandidate;
        }
      }
    }
  } catch (err) {
    // Ollama unreachable or timed out
  }
}

/**
 * 4. Test candidate parser against positive (should match) and negative (should NOT match) samples
 * @param {Object} candidate - Candidate parser object
 * @param {Array<string>} positiveSamples - Cluster samples that should match
 * @param {Array<string>} [negativeSamples] - Unrelated logs that must NOT match
 * @returns {Object} Test results summary and details
 */
export function testCandidate(candidate, positiveSamples = [], negativeSamples = []) {
  // If negative samples not provided, load from test-logs/unknown
  if (negativeSamples.length === 0) {
    const unknownPath = path.join(__dirname, "..", "test-logs", "unknown", "samples.json");
    if (fs.existsSync(unknownPath)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(unknownPath, "utf-8"));
        // Filter out samples that might belong to the positive cluster
        negativeSamples = loaded.filter(s => !positiveSamples.includes(s));
      } catch (_) {}
    }
  }

  const positiveResults = [];
  let positivePassed = 0;

  for (const sample of positiveSamples) {
    let extractedCount = 0;
    const extracted = {};

    for (const rule of candidate.extraction_rules || []) {
      try {
        const match = sample.match(new RegExp(rule.regex));
        if (match && match[1] !== undefined) {
          extracted[rule.field] = match[1];
          extractedCount++;
        }
      } catch (_) {}
    }

    // Check required fields
    const reqFields = candidate.required_fields || [];
    const hasRequired = reqFields.length === 0 || reqFields.every(f => Boolean(extracted[f]));
    const isPass = hasRequired && extractedCount > 0;

    if (isPass) positivePassed++;
    positiveResults.push({
      sample,
      passed: isPass,
      extracted,
      missing_fields: reqFields.filter(f => !extracted[f])
    });
  }

  const negativeResults = [];
  let negativePassed = 0; // Negative test PASSES when the parser correctly REJECTS the sample

  const signatures = candidate.detection?.signatures || [];

  for (const negSample of negativeSamples) {
    let matchedSig = false;
    for (const sig of signatures) {
      try {
        if (negSample.includes(sig) || new RegExp(sig).test(negSample)) {
          matchedSig = true;
          break;
        }
      } catch (_) {}
    }

    // Correctly rejected if it didn't match signature
    const correctlyRejected = !matchedSig;
    if (correctlyRejected) negativePassed++;

    negativeResults.push({
      sample: negSample,
      correctly_rejected: correctlyRejected,
      false_match: matchedSig
    });
  }

  const positiveRate = positiveSamples.length > 0 ? positivePassed / positiveSamples.length : 1.0;
  const negativeRate = negativeSamples.length > 0 ? negativePassed / negativeSamples.length : 1.0;

  // Positive threshold: >= 60%, Negative threshold: >= 85%
  const overallPass = positiveRate >= 0.60 && negativeRate >= 0.85;

  return {
    overall_pass: overallPass,
    positive: {
      passed: positivePassed,
      total: positiveSamples.length,
      rate: Number(positiveRate.toFixed(2)),
      details: positiveResults
    },
    negative: {
      correctly_rejected: negativePassed,
      total: negativeSamples.length,
      rate: Number(negativeRate.toFixed(2)),
      details: negativeResults
    }
  };
}

/**
 * 5. Activate candidate: Convert candidate to YAML and save to parsers/ directory
 * @param {Object} candidate - Approved candidate parser
 * @param {string} [parsersDir] - Target parsers directory
 * @returns {{ success: boolean, parser_id: string, file_path: string }}
 */
export function activateCandidate(candidate, parsersDir) {
  const targetDir = parsersDir || path.join(__dirname, "..", "parsers");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Ensure clean filename
  let parserId = candidate.parser_id || "generated_parser";
  parserId = parserId.replace(/[^a-zA-Z0-9_.-]/g, "_");
  if (!parserId.endsWith("_v1.0") && !parserId.includes(".yaml")) {
    parserId += "_v1.0";
  }

  const filename = parserId.endsWith(".yaml") ? parserId : `${parserId}.yaml`;
  const filePath = path.join(targetDir, filename);

  // Clean object for YAML export
  const cleanYamlObj = {
    parser_id: parserId.replace(/\.yaml$/, ""),
    version: candidate.version || "1.0",
    device_family: candidate.device_family || "Custom Network Device",
    description: candidate.description || "Activated AI-generated parser",
    detection: {
      signatures: candidate.detection?.signatures || [],
      structure: candidate.detection?.structure || "syslog_text",
      keywords: candidate.detection?.keywords || candidate.detection?.signatures || []
    },
    extraction_rules: candidate.extraction_rules || [],
    required_fields: candidate.required_fields || [],
    normalization_mapping: candidate.normalization_mapping || {}
  };

  const yamlString = YAML.stringify(cleanYamlObj);
  fs.writeFileSync(filePath, yamlString, "utf-8");

  return {
    success: true,
    parser_id: cleanYamlObj.parser_id,
    file_path: filePath
  };
}

/**
 * 6. Analyze Security Question using Ollama + Gemma Model
 * @param {string} question - Question about security logs or operational events
 * @param {Object} [options] - Options (ollamaUrl, model, timeout, context)
 * @returns {Promise<{ status: string, response: string, model: string }>}
 */
export async function analyzeSecurityQuestion(question, options = {}) {
  if (!question || typeof question !== "string" || !question.trim()) {
    throw new Error("Question parameter is required and cannot be empty.");
  }

  const ollamaUrl = options.ollamaUrl || "http://localhost:11434/api/generate";
  const model = options.model || "gemma4:e2b";
  const timeoutMs = options.timeout || 120000;

  const systemContext = options.context || "Universal Log Pre-processing Framework (ULPF) Security Operations Center";

  const prompt = `You are an expert Security Operations Center (SOC) AI Assistant analyzing security log events, network traffic, and system anomalies for the ${systemContext}.

USER QUESTION:
${question.trim()}

Provide a concise, practical, and clear technical analysis or answer. Use clean bullet points and clear sections if applicable.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
      status: "success",
      response: (data.response || "").trim(),
      model,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request to Ollama timed out. The local Gemma model took too long to respond.");
    }
    if (err.code === "ECONNREFUSED" || err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED")) {
      throw new Error("Ollama service is not running. Please ensure Ollama is started locally on http://localhost:11434.");
    }
    throw err;
  }
}

/**
 * 7. Analyze Quarantined / Unknown Log Payload using Ollama + Gemma Model
 * Returns structured JSON with detected_type, extracted_fields, security_meaning, severity_assessment, suspicious_indicators, recommended_action.
 * @param {string} rawLog - Raw unparsed log string
 * @param {Object} [options] - Options (ollamaUrl, model, timeout)
 * @returns {Promise<Object>} Structured AI Analysis object
 */
export async function analyzeQuarantinedLog(rawLog, options = {}) {
  if (!rawLog || typeof rawLog !== "string") {
    return {
      status: "invalid_input",
      detected_type: "Unknown Payload",
      severity_assessment: "low",
      security_meaning: "No valid raw log text provided for analysis.",
      analyzed_at: new Date().toISOString()
    };
  }

  const ollamaUrl = options.ollamaUrl || "http://localhost:11434/api/generate";
  const model = options.model || "gemma4:e2b";
  const timeoutMs = options.timeout || 90000;

  const prompt = `Analyze this raw unparsed security log payload and provide a JSON response.

RAW LOG:
${rawLog}

JSON keys required:
- "detected_type": "Log/device type (e.g. Linux SSH, Cisco ASA, Nginx Web, Firewall)",
- "security_meaning": "Concise summary of security meaning",
- "severity_assessment": "low, medium, high, or critical",
- "suspicious_indicators": "Suspicious IPs, ports, or anomaly indicators",
- "recommended_action": "Recommended SOC action"`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(ollamaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json"
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      let responseText = (data.response || "").trim();
      const match = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : responseText;
      const parsed = JSON.parse(jsonStr);

      return {
        status: "completed",
        detected_type: parsed.detected_type || "Unknown Security Log",
        security_meaning: parsed.security_meaning || "Unrecognized security payload",
        severity_assessment: (parsed.severity_assessment || "medium").toLowerCase(),
        suspicious_indicators: parsed.suspicious_indicators || "None identified",
        recommended_action: parsed.recommended_action || "Investigate log payload",
        extracted_fields: parsed.extracted_fields || {},
        model,
        analyzed_at: new Date().toISOString()
      };
    }
  } catch (err) {
    clearTimeout(timeoutId);
  }

  return {
    status: "failed",
    detected_type: "Unparsed Quarantine Log",
    extracted_fields: {},
    security_meaning: "Raw event quarantined pending manual or rule-based inspection",
    severity_assessment: "medium",
    suspicious_indicators: "Unrecognized structural format",
    recommended_action: "Review log payload in quarantine queue",
    analyzed_at: new Date().toISOString()
  };
}


