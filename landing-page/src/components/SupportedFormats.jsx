import React, { useState } from 'react';
import { FileCode2, Code2 } from 'lucide-react';

export default function SupportedFormats() {
  const [activeFormat, setActiveFormat] = useState('cisco');

  const formats = [
    {
      id: 'cisco',
      name: 'Cisco ASA',
      badge: 'SYSLOG',
      desc: 'Firewall syslog connection & drop events (%ASA-6-302013, %ASA-4-106023).',
      rawSample: `%ASA-6-302013: Built outbound TCP connection 208 for outside:192.168.1.50/443 to inside:10.0.0.12/51020`,
      yamlSpec: `id: cisco-asa
patterns:
  - regex: '%ASA-(?<level>\\d)-(?<event_code>\\d+): Built (?<direction>\\w+) (?<protocol>\\w+) connection'
fields:
  - name: event_code
    target: event.code`,
    },
    {
      id: 'fortinet',
      name: 'Fortinet',
      badge: 'KV SYSLOG',
      desc: 'FortiGate key-value syslog format for traffic, security, and web filter logs.',
      rawSample: `date=2026-10-04 time=09:32:00 devname="FG100D" type="traffic" subtype="forward" srcip=192.168.1.105 dstip=10.0.0.5 action="accept"`,
      yamlSpec: `id: fortinet-fortigate
type: key_value
kv_delimiter: "="
pair_delimiter: " "
fields:
  - name: srcip
    target: source.ip`,
    },
    {
      id: 'cef',
      name: 'CEF',
      badge: 'HEADER + KV',
      desc: 'Common Event Format standard with delimited header and extension pairs.',
      rawSample: `CEF:0|Check Point|VPN-1|R80.10|100000|Connection Allowed|3|src=10.0.0.25 dst=192.168.10.1 proto=tcp spt=443 dpt=58102`,
      yamlSpec: `id: generic-cef
patterns:
  - regex: '^CEF:(?<version>\\d+)\\|(?<vendor>[^\\|]+)\\|(?<product>[^\\|]+)'
fields:
  - name: src
    target: source.ip`,
    },
    {
      id: 'custom',
      name: 'Custom YAML Parsers',
      badge: 'DECLARATIVE',
      desc: 'Hot-reloaded user defined YAML regex specs for proprietary applications.',
      rawSample: `[2026-10-04 09:30:15] APP_AUTH_OK user=admin ip=10.0.0.99 duration=12ms`,
      yamlSpec: `id: my-custom-app
patterns:
  - regex: '\\[(?<timestamp>[^\\]]+)\\] (?<event>\\w+) user=(?<user>\\w+) ip=(?<ip>\\S+)'
fields:
  - name: ip
    target: source.ip`,
    },
  ];

  const currentFmt = formats.find((f) => f.id === activeFormat) || formats[0];

  return (
    <section id="formats" className="section section-border-top reveal-section">
      <div className="container">
        <div className="section-header text-center">
          <h2 className="section-title">Start with known formats. Extend when needed.</h2>
          <p className="section-subtitle">
            Loki ships with out-of-the-box parsers for standard network security vendors and allows instant YAML parser additions without restarting services.
          </p>
        </div>

        {/* Technical Format Switcher */}
        <div className="grid-4" style={{ marginBottom: '1.75rem' }}>
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setActiveFormat(fmt.id)}
              className="card"
              style={{
                cursor: 'pointer',
                textAlign: 'left',
                padding: '1.25rem',
                borderColor: activeFormat === fmt.id ? 'var(--border-strong)' : 'var(--border-subtle)',
                background: activeFormat === fmt.id ? '#141414' : 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <span className="card-number" style={{ margin: 0 }}>{fmt.badge}</span>
                <FileCode2 size={15} style={{ color: activeFormat === fmt.id ? '#ffffff' : 'var(--text-dim)' }} />
              </div>
              <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '0.3rem' }}>
                {fmt.name}
              </h3>
              <p className="card-desc" style={{ fontSize: '0.775rem' }}>
                {fmt.desc}
              </p>
            </button>
          ))}
        </div>

        {/* Raw Log Input vs YAML Rule Inspector */}
        <div className="scorecard-ui-mockup">
          <div className="scorecard-header">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.825rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Code2 size={15} />
              FORMAT SPECIFICATION: <strong style={{ color: '#ffffff' }}>{currentFmt.name}</strong>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-dim)' }}>
              Directory: <code style={{ color: 'var(--text-main)' }}>/parsers/*.yaml</code>
            </span>
          </div>

          <div className="scorecard-body">
            <div>
              <div style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
                RAW INGESTION SAMPLE
              </div>
              <div className="node-code-preview">
                <pre>{currentFmt.rawSample}</pre>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
                YAML PARSER REGEX RULE
              </div>
              <div className="node-code-preview">
                <pre>{currentFmt.yamlSpec}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
