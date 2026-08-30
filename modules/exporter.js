import { Client } from "@elastic/elasticsearch";

const client = new Client({
  node: "http://localhost:9200"
});

export async function exportEvent(completeEventEnvelope) {
  console.log(
    "EXPORTING STATUS:",
    completeEventEnvelope.processing_status
  );

  console.log(
    "EXPORTING HISTORY:",
    completeEventEnvelope.processing_state_history
  );

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

export { client };