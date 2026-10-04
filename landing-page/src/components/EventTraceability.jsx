import React, { useState } from 'react';
import { GitCommit, ArrowRight } from 'lucide-react';

export default function EventTraceability() {
  const [selectedTab, setSelectedTab] = useState('raw');

  const trailSteps = [
    { id: 'ingest', label: 'INGEST' },
    { id: 'resolve', label: 'RESOLVE' },
    { id: 'parse', label: 'PARSE' },
    { id: 'normalize', label: 'NORMALIZE' },
    { id: 'validate', label: 'VALIDATE' },
    { id: 'export', label: 'EXPORT' },
  ];

  const views = {
    raw: {
      title: '1. Raw Log Ingestion',
      code: `// Unstructured Vendor Log (Fortinet FortiGate Syslog)
<189>date=2026-10-04 time=09:32:00 devname="FG100D" devid="FG100D3G15800000" logid="0000000013" type="traffic" subtype="forward" level="notice" vd="root" srcip=192.168.1.105 srcport=54321 dstip=10.0.0.5 dstport=443 action="accept" proto=6`,
    },
    parsed: {
      title: '2. Parsed Key-Value Fields',
      code: `// Key-Value Extraction via Fortinet YAML Parser
{
  "devname": "FG100D",
  "logid": "0000000013",
  "type": "traffic",
  "subtype": "forward",
  "level": "notice",
  "srcip": "192.168.1.105",
  "srcport": 54321,
  "dstip": "10.0.0.5",
  "dstport": 443,
  "action": "accept",
  "proto": 6
}`,
    },
    normalized: {
      title: '3. OCSF Normalized Event Model',
      code: `// Standardized Event JSON
{
  "event_id": "evt-7721-bf90",
  "class_uid": 4001,
  "category_name": "Network Activity",
  "source": { "ip": "192.168.1.105", "port": 54321 },
  "destination": { "ip": "10.0.0.5", "port": 443 },
  "action": "ALLOWED",
  "severity": "INFORMATIONAL"
}`,
    },
    lineage: {
      title: '4. Immutable Field Lineage & Provenance Metadata',
      code: `// Field Lineage Tracking Metadata
{
  "lineage": {
    "source.ip": { "extracted_from": "srcip", "raw_value": "192.168.1.105", "transformer": "ip_validator" },
    "destination.ip": { "extracted_from": "dstip", "raw_value": "10.0.0.5", "transformer": "ip_validator" },
    "action": { "extracted_from": "action", "mapped_from": "accept", "mapped_to": "ALLOWED" }
  },
  "_provenance": {
    "parser_file": "parsers/fortinet.yaml",
    "parser_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "processed_by_host": "loki-worker-01"
  }
}`,
    },
    export: {
      title: '5. Elasticsearch Document Store',
      code: `// Indexed in ulpf-events Index
PUT /ulpf-events/_doc/evt-7721-bf90
{
  "@timestamp": "2026-10-04T09:32:00.000Z",
  "status": "INDEXED",
  "searchable_in_kibana": true
}`,
    },
  };

  return (
    <section id="traceability" className="section section-border-top reveal-section">
      <div className="container">
        <div className="section-header text-center">
          <h2 className="section-title">Every event has a trail.</h2>
          <p className="section-subtitle">
            Loki provides end-to-end event traceability through the processing pipeline so security analysts can inspect exact field lineage, raw inputs, and parser rules for compliance and forensics.
          </p>
        </div>

        {/* Pipeline Stage Journey */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '1.75rem', marginBottom: '1.75rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-dim)', marginBottom: '0.85rem', textTransform: 'uppercase' }}>
            EVENT PROCESSING MILESTONES
          </div>
          <div className="pipeline-milestones-row">
            {trailSteps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: '0.775rem', color: '#ffffff', fontWeight: 600 }}>
                  {step.label}
                </div>
                {index < trailSteps.length - 1 && <ArrowRight size={14} style={{ color: 'var(--text-dim)' }} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Field Transformation Lineage Selector */}
        <div className="traceability-grid">
          {/* Step Selection Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {Object.keys(views).map((key) => (
              <button
                key={key}
                onClick={() => setSelectedTab(key)}
                className="card"
                style={{
                  padding: '1rem 1.15rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderColor: selectedTab === key ? 'var(--border-strong)' : 'var(--border-subtle)',
                  background: selectedTab === key ? '#141414' : 'var(--bg-card)',
                }}
              >
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: selectedTab === key ? 'var(--accent-green)' : 'var(--text-dim)' }}>
                  STAGE SNAPSHOT
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', marginTop: '0.15rem' }}>
                  {views[key].title}
                </div>
              </button>
            ))}
          </div>

          {/* Lineage Code Inspector */}
          <div className="scorecard-ui-mockup">
            <div className="scorecard-header">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.825rem', color: '#ffffff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <GitCommit size={15} />
                {views[selectedTab].title}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                Event ID: evt-7721-bf90
              </span>
            </div>

            <div className="terminal-body">
              <pre>{views[selectedTab].code}</pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
