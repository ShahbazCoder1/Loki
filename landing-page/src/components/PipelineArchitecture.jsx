import React, { useState } from 'react';
import { ChevronRight, Activity } from 'lucide-react';

export default function PipelineArchitecture() {
  const [activeStage, setActiveStage] = useState('PARSE');

  const stages = [
    {
      id: 'INGEST',
      label: 'INGEST',
      step: '01',
      desc: 'Receives multi-vendor raw logs through the high-throughput HTTP API endpoint (POST /api/logs).',
      codeSample: `// Input Payload: POST /api/logs
{
  "raw": "%ASA-6-302013: Built outbound TCP connection 208 for outside:192.168.1.50/443 to inside:10.0.0.12/51020",
  "source_ip": "10.0.0.1",
  "received_at": "2026-10-04T09:30:00.000Z"
}`,
    },
    {
      id: 'RESOLVE',
      label: 'RESOLVE',
      step: '02',
      desc: 'Source Resolver inspects event headers & regex fingerprints to select the matching parser. Unrecognized logs branch to Quarantine.',
      codeSample: `// Source Resolver Match
{
  "parser_id": "cisco-asa-fw",
  "matched_by": "header_pattern",
  "pattern": "%ASA-\\\\d+-\\\\d+:",
  "confidence": 1.0
}`,
    },
    {
      id: 'PARSE',
      label: 'PARSE',
      step: '03',
      desc: 'Parser Engine applies YAML-defined regex rules to extract key-value pairs from raw log text.',
      codeSample: `// Extracted Raw Fields
{
  "event_code": "302013",
  "direction": "outbound",
  "protocol": "TCP",
  "dst_interface": "outside",
  "dst_ip": "192.168.1.50",
  "dst_port": 443,
  "src_interface": "inside",
  "src_ip": "10.0.0.12",
  "src_port": 51020
}`,
    },
    {
      id: 'NORMALIZE',
      label: 'NORMALIZE',
      step: '04',
      desc: 'Normalizer transforms vendor-specific field names into a unified event schema with standardized severity levels.',
      codeSample: `// Normalized Schema Object
{
  "event.kind": "event",
  "event.category": "network",
  "event.type": "connection",
  "source.ip": "10.0.0.12",
  "source.port": 51020,
  "destination.ip": "192.168.1.50",
  "destination.port": 443,
  "network.transport": "tcp"
}`,
    },
    {
      id: 'VALIDATE',
      label: 'VALIDATE',
      step: '05',
      desc: 'Schema Validator enforces required data types and ranges. Failed events are routed to Dead-Letter index for auditing.',
      codeSample: `// Validation Scorecard
{
  "status": "VALIDATED",
  "schema": "ocsf-network-activity-v1",
  "checks_passed": 12,
  "errors": []
}`,
    },
    {
      id: 'ASSEMBLE',
      label: 'ASSEMBLE',
      step: '06',
      desc: 'Event Assembler binds provenance metadata, processing timestamps, and immutable execution lineage UUIDs.',
      codeSample: `// Assembled Provenance Envelope
{
  "event_id": "evt-8f4b-4890",
  "lineage_id": "lin-9921-a4b1",
  "_provenance": {
    "ingested_at": "2026-10-04T09:30:00.102Z",
    "parser_version": "1.4.0"
  }
}`,
    },
    {
      id: 'EXPORT',
      label: 'EXPORT',
      step: '07',
      desc: 'Exports clean normalized events to Elasticsearch (ulpf-events), streams Server-Sent Events (SSE), and updates Kibana.',
      codeSample: `// Elasticsearch Indexing (ulpf-events)
PUT /ulpf-events/_doc/evt-8f4b-4890
{
  "index": "ulpf-events-2026.10",
  "status": "INDEXED",
  "sse_broadcast": true
}`,
    },
  ];

  const currentStageInfo = stages.find((s) => s.id === activeStage) || stages[2];

  return (
    <section id="pipeline" className="section section-border-top">
      <div className="container">
        <div className="section-header text-center">
          <div className="badge-tag">END-TO-END DATAFLOW</div>
          <h2 className="section-title">From raw log to normalized event.</h2>
          <p className="section-subtitle">
            An enterprise pre-processing pipeline designed for deterministic log handling, automated normalization, and zero silent data drop.
          </p>
        </div>

        {/* Technical Architecture System Diagram */}
        <div className="pipeline-flow-wrapper">
          <div className="pipeline-nodes-container">
            {stages.map((stage, idx) => (
              <React.Fragment key={stage.id}>
                <button
                  className={`pipeline-node-btn ${activeStage === stage.id ? 'active' : ''}`}
                  onClick={() => setActiveStage(stage.id)}
                >
                  <span className="node-step-tag">Step {stage.step}</span>
                  <span className="node-name">{stage.label}</span>
                </button>

                {idx < stages.length - 1 && (
                  <div className="pipeline-connector">
                    <ChevronRight size={16} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Branch Outlets */}
          <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            <div>● RESOLVE ➔ Quarantine Index (Unknown formats)</div>
            <div>● VALIDATE ➔ Dead Letter Index (Schema errors)</div>
            <div>● EXPORT ➔ Elasticsearch & SSE Stream</div>
          </div>

          {/* Selected Stage Detail Panel */}
          <div className="node-detail-box">
            <div className="node-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <Activity size={15} style={{ color: 'var(--accent-green)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  STAGE {currentStageInfo.step} OF 07
                </span>
              </div>
              <h4>{currentStageInfo.label} PROCESS</h4>
              <p>{currentStageInfo.desc}</p>
            </div>

            <div className="node-code-preview">
              <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>STAGE DATA SNAPSHOT</span>
                <span>JSON / API</span>
              </div>
              <pre>{currentStageInfo.codeSample}</pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
