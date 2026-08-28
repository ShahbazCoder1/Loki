import { Client } from "@elastic/elasticsearch";

const client = new Client({
  node: "http://localhost:9200"
});

export async function exportEvent(completeEventEnvelope) {
  return client.index({
    index: "ulpf-events",
    id: completeEventEnvelope.event_id,
    document: completeEventEnvelope
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
    document
  });
}

export async function deadLetterEvent(eventEnvelope, error) {
  const document = {
    ...eventEnvelope,
    dead_letter_error: {
      message: error.message || String(error),
      timestamp: new Date().toISOString()
    }
  };

  return client.index({
    index: "ulpf-deadletter",
    id: eventEnvelope.event_id,
    document
  });
}

export { client };