import { Client } from "@elastic/elasticsearch";

const client = new Client({
  node: process.env.ELASTICSEARCH_URL
});

async function createIndex(index, mappings) {
  const exists = await client.indices.exists({ index });

  if (exists) {
    console.log(`Index already exists: ${index}`);
    return;
  }

  await client.indices.create({
    index,
    mappings
  });

  console.log(`Created index: ${index}`);
}

async function setupIndices() {
  try {
    await createIndex("ulpf-events", {
      properties: {
        event_id: { type: "keyword" },
        content_fingerprint: { type: "keyword" },
        received_at: { type: "date" },
        processing_status: { type: "keyword" }
      }
    });

    await createIndex("ulpf-quarantine", {
      properties: {
        event_id: { type: "keyword" },
        quarantine_reason: { type: "keyword" },
        quarantined_at: { type: "date" },
        ai_analysis: {
          properties: {
            status: { type: "keyword" },
            detected_type: { type: "keyword" },
            severity_assessment: { type: "keyword" },
            security_meaning: { type: "text" },
            suspicious_indicators: { type: "text" },
            recommended_action: { type: "text" },
            analyzed_at: { type: "date" }
          }
        }
      }
    });

    await createIndex("ulpf-deadletter", {
      properties: {
        event_id: { type: "keyword" },
        dead_letter_error: {
          properties: {
            message: { type: "text" },
            timestamp: { type: "date" }
          }
        }
      }
    });

    console.log("All Elasticsearch indices are ready.");
  } catch (error) {
    console.error("Failed to set up Elasticsearch indices:", error);
    process.exitCode = 1;
  }
}

setupIndices();