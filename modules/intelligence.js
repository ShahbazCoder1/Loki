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
 * Helper to generate smart fallback parser when Ollama is unavailable
 */
function generateFallbackParser(cluster) {
  const sample = (cluster.samples && cluster.samples[0]) || cluster.template || "";
  
  let parserId = "custom_device";
  let deviceFamily = "Generic Network Device";
  let structure = "syslog_text";
  const signatures = [];
  const extractionRules = [];
  const requiredFields = [];
  const normalizationMapping = {};

  // Detect signature from known patterns in sample
  if (sample.includes("filterlog")) {
    parserId = "pfsense_filterlog";
    deviceFamily = "pfSense";
    structure = "csv";
    signatures.push("filterlog");
    extractionRules.push(
      { field: "src_ip", regex: "(?:\\d+,){19}(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})" },
      { field: "dst_ip", regex: "(?:\\d+,){20}(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})" },
      { field: "action", regex: "(?:pass|block|match,block|match,pass)" }
    );
    requiredFields.push("src_ip", "action");
    normalizationMapping.src_ip = "src_endpoint.ip";
    normalizationMapping.dst_ip = "dst_endpoint.ip";
    normalizationMapping.action = "action";
  } else if (sample.includes("RT_FLOW")) {
    parserId = "juniper_srx";
    deviceFamily = "Juniper SRX";
    structure = "syslog_text";
    signatures.push("RT_FLOW:");
    extractionRules.push(
      { field: "event_type", regex: "(RT_FLOW_SESSION_[A-Z_]+)" },
      { field: "src_ip", regex: "(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})/\\d+->" },
      { field: "src_port", regex: "\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/(\\d+)->" },
      { field: "dst_ip", regex: "->(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})/\\d+" },
      { field: "dst_port", regex: "->\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/(\\d+)" }
    );
    requiredFields.push("src_ip", "dst_ip", "event_type");
    normalizationMapping.src_ip = "src_endpoint.ip";
    normalizationMapping.dst_ip = "dst_endpoint.ip";
    normalizationMapping.src_port = "src_endpoint.port";
    normalizationMapping.dst_port = "dst_endpoint.port";
    normalizationMapping.event_type = "event_type";
  } else if (sample.includes("sshd[")) {
    parserId = "linux_sshd";
    deviceFamily = "Linux SSH";
    structure = "syslog_text";
    signatures.push("sshd[");
    extractionRules.push(
      { field: "action", regex: "\\b(Failed|Accepted)\\s+password" },
      { field: "user", regex: "for\\s+(?:invalid\\s+user\\s+)?([\\w.-]+)\\s+from" },
      { field: "src_ip", regex: "from\\s+(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})" },
      { field: "src_port", regex: "port\\s+(\\d+)" }
    );
    requiredFields.push("src_ip", "action");
    normalizationMapping.src_ip = "src_endpoint.ip";
    normalizationMapping.src_port = "src_endpoint.port";
    normalizationMapping.action = "action";
  } else {
    // Generic auto-extractor from sample
    const words = sample.split(/\s+/);
    const candidateSig = words.find(w => w.length > 4 && /^[a-zA-Z0-9_-]+[:[]?$/.test(w)) || words[0] || "LOG_EVENT";
    signatures.push(candidateSig.replace(/[:[\]]/g, ""));
    
    // IP extractors
    if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(sample)) {
      extractionRules.push({ field: "src_ip", regex: "(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})" });
      requiredFields.push("src_ip");
      normalizationMapping.src_ip = "src_endpoint.ip";
    }
    
    // Action extractors
    if (/(allow|block|drop|deny|accept|reject|pass)/i.test(sample)) {
      extractionRules.push({ field: "action", regex: "\\b(allow|block|drop|deny|accept|reject|pass)\\b" });
      requiredFields.push("action");
      normalizationMapping.action = "action";
    }
  }

  return {
    parser_id: parserId + "_v1.0",
    version: "1.0",
    device_family: deviceFamily,
    description: `Auto-generated parser for ${deviceFamily}`,
    detection: {
      signatures,
      structure,
      keywords: signatures
    },
    extraction_rules: extractionRules,
    required_fields: requiredFields,
    normalization_mapping: normalizationMapping,
    is_generated: true,
    generated_at: new Date().toISOString()
  };
}

/**
 * 3. Generate candidate parser from cluster samples using Ollama or fallback
 * @param {Object} cluster - Cluster object with samples and template
 * @param {Object} [options] - Options (ollamaUrl, model)
 * @returns {Promise<Object>} Generated candidate parser
 */
export async function generateCandidateParser(cluster, options = {}) {
  const ollamaUrl = options.ollamaUrl || "http://localhost:11434/api/generate";
  const model = options.model || "gemma3:4b";
  const samples = cluster.samples || [cluster.template];

  const prompt = `You are a log parsing expert. Analyze these perimeter security log samples from the same source device and generate a parser definition.

SAMPLES:
${samples.join("\n")}

STRUCTURAL TEMPLATE:
${cluster.template || ""}

Generate a JSON object with:
- parser_id: snake_case string (e.g. "juniper_srx_v1.0")
- version: "1.0"
- device_family: name of device/vendor (e.g. "Juniper SRX")
- description: short description
- detection: object with { signatures: [string], structure: "syslog_text"|"key_value"|"cef"|"json"|"csv", keywords: [string] }
- extraction_rules: array of { field: string, regex: "regex with exactly one capture group ()" }
- required_fields: array of field names that must be present
- normalization_mapping: object mapping extracted field name to OCSF field path (e.g. "src_ip" -> "src_endpoint.ip", "action" -> "action")

Return ONLY valid JSON matching this structure. No markdown formatting, no code fences, no extra text.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

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

      // Validate core properties
      if (parsedCandidate && parsedCandidate.detection && Array.isArray(parsedCandidate.extraction_rules)) {
        if (!parsedCandidate.parser_id) parsedCandidate.parser_id = "ai_candidate_v1.0";
        if (!parsedCandidate.version) parsedCandidate.version = "1.0";
        parsedCandidate.source = "ollama_" + model;
        parsedCandidate.is_generated = true;
        parsedCandidate.generated_at = new Date().toISOString();
        return parsedCandidate;
      }
    }
  } catch (err) {
    // Ollama unreachable or timed out -> use smart fallback
  }

  // Graceful fallback to smart heuristic parser generator
  const fallback = generateFallbackParser(cluster);
  fallback.source = "heuristic_fallback";
  return fallback;
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
