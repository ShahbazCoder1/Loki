import { Client } from "@elastic/elasticsearch";

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  requestTimeout: Number(process.env.ELASTICSEARCH_REQUEST_TIMEOUT_MS || 3000),
  maxRetries: 0
});

export async function exportEvent(completeEventEnvelope) {
  return client.index({
    index: "ulpf-events",
    id: completeEventEnvelope.event_id,
    document: completeEventEnvelope,
    refresh: true
  });
}

export async function quarantineEvent(eventEnvelope, reason) {
  const document = {
    ...eventEnvelope,
    quarantine_reason: reason,
    quarantined_at: new Date().toISOString()
  };

  return client.index({
    index: "ulpf-quarantine",
    id: eventEnvelope.event_id,
    document,
    refresh: true
  });
}

export async function deadLetterEvent(eventEnvelope, error) {
  const document = {
    ...eventEnvelope,
    dead_letter_error: {
      message: Array.isArray(error)
        ? error.join("; ")
        : error?.message || String(error),
      timestamp: new Date().toISOString()
    }
  };

  return client.index({
    index: "ulpf-deadletter",
    id: eventEnvelope.event_id,
    document,
    refresh: true
  });
}

export async function updateQuarantineAIAnalysis(eventId, aiAnalysis) {
  try {
    return await client.update({
      index: "ulpf-quarantine",
      id: eventId,
      doc: {
        ai_analysis: aiAnalysis
      },
      refresh: true
    });
  } catch (error) {
    console.error(`Failed to update AI analysis for quarantined event ${eventId}:`, error.message);
    return null;
  }
}

export async function updateQuarantineCandidateUrls(clusterId, approveUrl, rejectUrl) {
  try {
    console.log(`[quarantine-urls] Updating clusterId: ${clusterId}`);
    console.log(`[quarantine-urls] approve_url: ${approveUrl}`);
    console.log(`[quarantine-urls] reject_url: ${rejectUrl}`);

    const searchRes = await client.search({
      index: "ulpf-quarantine",
      size: 1000,
      query: {
        bool: {
          should: [
            { match: { structural_fingerprint: clusterId } },
            { term: { "structural_fingerprint.keyword": clusterId } }
          ]
        }
      }
    });

    const hits = searchRes.hits?.hits || [];
    console.log(`[quarantine-urls] Hits found for cluster ${clusterId}: ${hits.length}`);

    for (const hit of hits) {
      console.log(`[quarantine-urls] Updating document ID: ${hit._id}`);
      const updateRes = await client.update({
        index: "ulpf-quarantine",
        id: hit._id,
        doc: {
          approve_url: approveUrl,
          reject_url: rejectUrl
        },
        refresh: true
      });
      console.log(`[quarantine-urls] Update result for ${hit._id}:`, updateRes.result);
    }
    return hits.length;
  } catch (error) {
    console.error(`[quarantine-urls] Error updating cluster ${clusterId}:`, error.message);
    if (error.stack) console.error(error.stack);
    return 0;
  }
}

export { client };

