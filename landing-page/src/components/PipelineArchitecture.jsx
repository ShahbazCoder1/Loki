import React, { useState } from 'react';
import { ChevronRight, Activity } from 'lucide-react';

function highlightCode(codeStr) {
  const lines = codeStr.split('\n');
  return lines.map((line, lineIdx) => {
    if (line.trim().startsWith('//')) {
      return (
        <div key={lineIdx} className="code-line">
          <span className="token-comment">{line}</span>
        </div>
      );
    }

    if (line.startsWith('PUT ') || line.startsWith('POST ')) {
      const parts = line.split(' ');
      return (
        <div key={lineIdx} className="code-line">
          <span className="token-keyword">{parts[0]}</span>{' '}
          <span className="token-string">{line.substring(parts[0].length + 1)}</span>
        </div>
      );
    }

    const tokens = [];
    const regex = /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\]:,])/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({
          type: 'text',
          value: line.substring(lastIndex, match.index),
        });
      }

      const tokenVal = match[0];
      if (/^"/.test(tokenVal)) {
        if (/:$/.test(tokenVal)) {
          tokens.push({ type: 'key', value: tokenVal.slice(0, -1) });
          tokens.push({ type: 'punct', value: ':' });
        } else {
          tokens.push({ type: 'string', value: tokenVal });
        }
      } else if (/^(true|false)$/.test(tokenVal)) {
        tokens.push({ type: 'boolean', value: tokenVal });
      } else if (/^null$/.test(tokenVal)) {
        tokens.push({ type: 'null', value: tokenVal });
      } else if (!isNaN(Number(tokenVal))) {
        tokens.push({ type: 'number', value: tokenVal });
      } else {
        tokens.push({ type: 'punct', value: tokenVal });
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      tokens.push({ type: 'text', value: line.substring(lastIndex) });
    }

    return (
      <div key={lineIdx} className="code-line">
        {tokens.map((token, tokIdx) => {
          switch (token.type) {
            case 'key':
              return <span key={tokIdx} className="token-key">{token.value}</span>;
            case 'string':
              return <span key={tokIdx} className="token-string">{token.value}</span>;
            case 'number':
              return <span key={tokIdx} className="token-number">{token.value}</span>;
            case 'boolean':
              return <span key={tokIdx} className="token-boolean">{token.value}</span>;
            case 'null':
              return <span key={tokIdx} className="token-null">{token.value}</span>;
            case 'punct':
              return <span key={tokIdx} className="token-punct">{token.value}</span>;
            default:
              return <React.Fragment key={tokIdx}>{token.value}</React.Fragment>;
          }
        })}
      </div>
    );
  });
}

export default function PipelineArchitecture() {
  const [activeStage, setActiveStage] = useState('PARSE');

  const stages = [
    {
      id: 'INGEST',
      label: 'INGEST',
      step: '01',
      desc: 'Receives multi-vendor raw logs through the HTTP API and stores authentic raw event records (raw-events/).',
      codeSample: `// Source: raw-events/0005e8c0-fcf5-48c7-8ea1-f524e6b86d5a.json
{
  "event_id": "0005e8c0-fcf5-48c7-8ea1-f524e6b86d5a",
  "content_fingerprint": "67fea89b1463a546f80dc7114a3ec83123ea397b74e07d461a0b3aac11e7b38d",
  "received_at": "2026-09-23T15:14:40.775Z",
  "raw": {
    "immutable_payload": "%ASA-3-710003: TCP access denied by ACL from 203.0.113.128/40763 to outside:192.168.1.22/22",
    "encoding": "utf-8",
    "integrity_hash": "sha256:67fea89b1463a546f80dc7114a3ec83123ea397b74e07d461a0b3aac11e7b38d"
  },
  "transport": {
    "receiver": "http_api",
    "protocol": "http"
  },
  "processing_status": "RECEIVED"
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
  "event_code": "710003",
  "action": "denied",
  "protocol": "TCP",
  "src_ip": "203.0.113.128",
  "src_port": 40763,
  "dst_interface": "outside",
  "dst_ip": "192.168.1.22",
  "dst_port": 22
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
  "action": "DENIED",
  "source.ip": "203.0.113.128",
  "source.port": 40763,
  "destination.ip": "192.168.1.22",
  "destination.port": 22,
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
  "event_id": "0005e8c0-fcf5-48c7-8ea1-f524e6b86d5a",
  "lineage_id": "lin-67fe-a89b",
  "_provenance": {
    "ingested_at": "2026-09-23T15:14:40.775Z",
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
PUT /ulpf-events/_doc/0005e8c0-fcf5-48c7-8ea1-f524e6b86d5a
{
  "index": "ulpf-events-2026.09",
  "status": "INDEXED",
  "sse_broadcast": true
}`,
    },
  ];

  const currentStageInfo = stages.find((s) => s.id === activeStage) || stages[2];

  return (
    <section id="pipeline" className="section section-border-top reveal-section">
      <div className="container">
        <div className="section-header text-center">
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
              <pre>{highlightCode(currentStageInfo.codeSample)}</pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

