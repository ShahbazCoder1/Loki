import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default scoring weights and thresholds (assumed M1 config)
const DEFAULT_SCORING = {
  weights: {
    signature: 0.40,
    structural: 0.35,
    metadata: 0.25
  },
  routing_threshold: 0.70,
  winner_margin: 0.10
};

// Assumed M1 parser definitions used as fallback when parsers directory is absent/empty
const ASSUMED_PARSERS = [
  {
    parser_id: "cisco_asa_v1.0",
    version: "1.0",
    device_family: "Cisco",
    description: "Cisco ASA firewall log parser",
    detection: {
      signatures: ["%ASA-"],
      structure: "syslog_text",
      keywords: ["Built", "Teardown", "Deny"]
    }
  },
  {
    parser_id: "fortinet_v1.0",
    version: "1.0",
    device_family: "Fortinet",
    description: "Fortinet FortiGate firewall log parser",
    detection: {
      signatures: ["devname=FGT", "logid="],
      structure: "key_value",
      keywords: ["type=traffic", "subtype=forward", "action="]
    }
  },
  {
    parser_id: "generic_cef_v1.0",
    version: "1.0",
    device_family: "Generic CEF",
    description: "Generic Common Event Format log parser",
    detection: {
      signatures: ["CEF:"],
      structure: "cef",
      keywords: ["src=", "dst=", "act="]
    }
  }
];

/**
 * Locate and load the scoring configuration
 */
function loadScoringConfig(configPath) {
  const candidatePaths = configPath
    ? [configPath]
    : [
        path.join(__dirname, "../config/scoring.json"),
        path.join(__dirname, "../../config/scoring.json"),
        path.join(process.cwd(), "ulpf-prototype/config/scoring.json"),
        path.join(process.cwd(), "config/scoring.json")
      ];

  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        return {
          weights: {
            signature: data?.weights?.signature ?? DEFAULT_SCORING.weights.signature,
            structural: data?.weights?.structural ?? DEFAULT_SCORING.weights.structural,
            metadata: data?.weights?.metadata ?? DEFAULT_SCORING.weights.metadata
          },
          routing_threshold: data?.routing_threshold ?? DEFAULT_SCORING.routing_threshold,
          winner_margin: data?.winner_margin ?? DEFAULT_SCORING.winner_margin
        };
      } catch (e) {
        console.warn(`Warning: Could not parse scoring config at ${p}, using defaults.`);
      }
    }
  }

  return DEFAULT_SCORING;
}

/**
 * Locate and load all parser YAML files from the parsers directory
 */
function loadParsers(parsersDir) {
  const candidateDirs = parsersDir
    ? [parsersDir]
    : [
        path.join(__dirname, "../parsers"),
        path.join(__dirname, "../../parsers"),
        path.join(process.cwd(), "ulpf-prototype/parsers"),
        path.join(process.cwd(), "parsers")
      ];

  let targetDir = null;
  for (const d of candidateDirs) {
    if (d && fs.existsSync(d) && fs.statSync(d).isDirectory()) {
      targetDir = d;
      break;
    }
  }

  if (!targetDir) {
    return ASSUMED_PARSERS;
  }

  const files = fs.readdirSync(targetDir);
  const parsers = [];

  for (const file of files) {
    if (file.endsWith(".yaml") || file.endsWith(".yml")) {
      const fullPath = path.join(targetDir, file);
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        const parsed = YAML.parse(content);
        if (parsed && typeof parsed === "object") {
          parsed._filename = file;
          if (!parsed.parser_id) {
            parsed.parser_id = path.basename(file, path.extname(file));
          }
          parsers.push(parsed);
        }
      } catch (err) {
        console.warn(`Warning: Could not parse YAML file at ${fullPath}:`, err.message);
      }
    }
  }

  return parsers.length > 0 ? parsers : ASSUMED_PARSERS;
}

/**
 * Evaluates whether a raw log matches signature requirements
 */
function checkSignature(rawLog, signatures) {
  if (!signatures) return false;
  const list = Array.isArray(signatures) ? signatures : [signatures];
  if (list.length === 0) return false;

  for (const sig of list) {
    if (typeof sig !== "string") continue;
    if (rawLog.includes(sig)) return true;
    try {
      const regex = new RegExp(sig);
      if (regex.test(rawLog)) return true;
    } catch (_) {}
  }
  return false;
}

/**
 * Evaluates structural features of a log line
 */
function checkStructure(rawLog, structureType) {
  if (!structureType || typeof structureType !== "string") return false;
  const type = structureType.toLowerCase();

  switch (type) {
    case "cef":
      return /CEF:\d\|/i.test(rawLog) || rawLog.includes("CEF:");

    case "key_value":
    case "kv": {
      const kvMatches = rawLog.match(/\b[\w.-]+=[^\s]+/g);
      return Boolean(kvMatches && kvMatches.length >= 2);
    }

    case "json":
      try {
        const obj = JSON.parse(rawLog);
        return typeof obj === "object" && obj !== null;
      } catch (_) {
        return false;
      }

    case "csv":
      return rawLog.includes(",") && rawLog.split(",").length >= 3;

    case "syslog_text":
    case "syslog": {
      if (/CEF:\d\|/i.test(rawLog)) return false;
      if (/^\s*\{[\s\S]*\}\s*$/.test(rawLog)) return false;
      const kvCount = (rawLog.match(/\b[\w.-]+=[^\s]+/g) || []).length;
      if (kvCount >= 3) return false;
      return true;
    }

    default:
      return rawLog.toLowerCase().includes(type);
  }
}

/**
 * Evaluates keyword/metadata hints
 */
function checkMetadata(rawLog, keywords) {
  if (!keywords) return false;
  const list = Array.isArray(keywords) ? keywords : [keywords];
  if (list.length === 0) return false;

  for (const kw of list) {
    if (typeof kw !== "string") continue;
    if (rawLog.includes(kw)) return true;
    try {
      const regex = new RegExp(kw, "i");
      if (regex.test(rawLog)) return true;
    } catch (_) {}
  }
  return false;
}

/**
 * Main resolve function for Source Resolver
 * 
 * @param {Object|string} eventEnvelope - Event envelope object containing raw.immutable_payload or raw log string
 * @param {Object} [options] - Optional override settings (parsers, parsersDir, configPath, scoring)
 * @returns {{ parserId: string|null, confidence: number, evidence: Object, status: string }}
 */
export function resolve(eventEnvelope, options = {}) {
  // Extract raw log string
  let rawLog = "";
  if (typeof eventEnvelope === "string") {
    rawLog = eventEnvelope;
  } else if (eventEnvelope && eventEnvelope.raw && typeof eventEnvelope.raw.immutable_payload === "string") {
    rawLog = eventEnvelope.raw.immutable_payload;
  }

  // Determine scoring configuration
  const scoringConfig = options.scoring || loadScoringConfig(options.configPath);
  const weights = scoringConfig.weights || DEFAULT_SCORING.weights;
  const routingThreshold = scoringConfig.routing_threshold ?? DEFAULT_SCORING.routing_threshold;
  const winnerMargin = scoringConfig.winner_margin ?? DEFAULT_SCORING.winner_margin;

  // Load parsers
  const parsers = Array.isArray(options.parsers)
    ? options.parsers
    : loadParsers(options.parsersDir);

  const evidence = {};

  if (!rawLog || parsers.length === 0) {
    return {
      parserId: null,
      confidence: 0.0,
      evidence,
      status: "UNKNOWN"
    };
  }

  const scoredParsers = [];

  for (const parser of parsers) {
    const parserId = parser.parser_id || parser._filename || "unknown_parser";
    const detection = parser.detection || {};

    const sigMatched = checkSignature(rawLog, detection.signatures);
    const structMatched = checkStructure(rawLog, detection.structure);
    const metaMatched = checkMetadata(rawLog, detection.keywords);

    const sigScore = sigMatched ? weights.signature : 0.0;
    const structScore = structMatched ? weights.structural : 0.0;
    const metaScore = metaMatched ? weights.metadata : 0.0;

    const totalScore = Number((sigScore + structScore + metaScore).toFixed(4));

    evidence[parserId] = {
      score: totalScore,
      breakdown: {
        signature: Number(sigScore.toFixed(4)),
        structural: Number(structScore.toFixed(4)),
        metadata: Number(metaScore.toFixed(4))
      },
      details: {
        signatureMatched: sigMatched,
        structuralMatched: structMatched,
        metadataMatched: metaMatched
      }
    };

    scoredParsers.push({
      parserId,
      score: totalScore
    });
  }

  // Sort descending by total score
  scoredParsers.sort((a, b) => b.score - a.score);

  const highest = scoredParsers[0];
  const secondHighestScore = scoredParsers.length > 1 ? scoredParsers[1].score : 0.0;
  const margin = Number((highest.score - secondHighestScore).toFixed(4));

  let status = "UNKNOWN";
  let parserId = null;

  if (highest.score >= routingThreshold) {
    if (margin >= winnerMargin) {
      status = "RESOLVED";
      parserId = highest.parserId;
    } else {
      status = "AMBIGUOUS";
      parserId = highest.parserId;
    }
  } else {
    status = "UNKNOWN";
    parserId = null;
  }

  return {
    parserId,
    confidence: highest.score,
    evidence,
    status
  };
}

export default resolve;
