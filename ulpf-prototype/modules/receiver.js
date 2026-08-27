const { v4: uuidv4 } = require("uuid");
const CryptoJS = require("crypto-js");
const fs = require("fs");
const path = require("path");

function sha256(data) {
  return CryptoJS.SHA256(data).toString();
}

function receive(rawLogString) {
  const eventId = uuidv4();
  const hash = sha256(rawLogString);

  const event = {
    event_id: eventId,

    content_fingerprint: hash,

    received_at: new Date().toISOString(),

    raw: {
      immutable_payload: rawLogString,
      encoding: "utf-8",
      integrity_hash: "sha256:" + hash
    },

    transport: {
      receiver: "http_api",
      protocol: "http"
    },

    // Filled by later modules
    source: null,
    parsed: null,
    normalized: null,

    extensions: {},
    provenance: [],
    field_lineage: {},

    processing_status: "RECEIVED",

    processing_state_history: ["RECEIVED"]
  };

  // Raw archive directory
  const rawEventsDir = path.join(__dirname, "..", "raw-events");

  // Create it if it doesn't exist
  if (!fs.existsSync(rawEventsDir)) {
    fs.mkdirSync(rawEventsDir, { recursive: true });
  }

  // Save the complete event envelope
  const filePath = path.join(
    rawEventsDir,
    `${eventId}.json`
  );

  fs.writeFileSync(
    filePath,
    JSON.stringify(event, null, 2)
  );

  return event;
}

module.exports = {
  receive
};