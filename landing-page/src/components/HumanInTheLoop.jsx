import React, { useState } from 'react';
import { Check, X, ShieldCheck, Cpu, TestTube, UserCheck } from 'lucide-react';

export default function HumanInTheLoop() {
  const [decision, setDecision] = useState(null);

  const sampleYamlDraft = `id: custom-app-auth
name: Custom App Authentication Log
patterns:
  - regex: '^%{TIMESTAMP_ISO8601:timestamp} \\[(?<severity>\\w+)\\] user=(?<user>\\w+) ip=(?<src_ip>\\S+) action=(?<action>\\w+)$'
fields:
  - name: timestamp
    target: "@timestamp"
  - name: src_ip
    target: "source.ip"
  - name: user
    target: "user.name"`;

  return (
    <section className="section section-border-top">
      <div className="container">
        <div className="section-header text-center">
          <div className="badge-tag">GOVERNANCE & AUDITABILITY</div>
          <h2 className="section-title">AI proposes. Humans decide.</h2>
          <p className="section-subtitle">
            AI generates candidate parsers, automated tests validate regex execution, and security analysts retain final approval to activate rules into production.
          </p>
        </div>

        {/* Technical Scorecard UI */}
        <div className="scorecard-ui-mockup">
          <div className="scorecard-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--text-main)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem', color: '#ffffff' }}>
                CANDIDATE PARSER REVIEW #PR-2026-09
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                Target Index: <code style={{ color: 'var(--text-main)' }}>ulpf-events</code>
              </span>
              <span className="score-chip">
                Status: PENDING REVIEW
              </span>
            </div>
          </div>

          <div className="scorecard-body">
            {/* Left Panel: AI Proposed YAML Draft */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Cpu size={14} />
                  AI Candidate Generator (Gemma 7B)
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-dim)' }}>YAML Spec v1.0</span>
              </div>

              <div className="node-code-preview" style={{ height: '230px' }}>
                <pre>{sampleYamlDraft}</pre>
              </div>
            </div>

            {/* Right Panel: Test Scorecard & Approval Decision */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem' }}>
                  <TestTube size={15} style={{ color: 'var(--text-main)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.825rem', fontWeight: 600, color: '#ffffff' }}>
                    AUTOMATED TEST SCORECARD
                  </span>
                </div>

                <div className="scorecard-metrics">
                  <div className="score-chip">
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>100%</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Match Rate</div>
                  </div>
                  <div className="score-chip">
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>0</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Schema Errors</div>
                  </div>
                  <div className="score-chip">
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>45/45</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>Sample Logs</div>
                  </div>
                </div>

                <ul style={{ listStyle: 'none', fontSize: '0.825rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={14} style={{ color: 'var(--accent-green)' }} />
                    Regex pattern matches 100% of quarantined log cluster
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={14} style={{ color: 'var(--accent-green)' }} />
                    Field mappings comply with OCSF Network Activity schema
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={14} style={{ color: 'var(--accent-green)' }} />
                    Hot-reload verification passed on local engine
                  </li>
                </ul>
              </div>

              {/* Human Review Action Controls */}
              <div style={{ background: '#080808', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem', color: '#ffffff', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <UserCheck size={15} />
                  HUMAN REVIEW DECISION
                </div>

                {decision === null && (
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.825rem' }}
                      onClick={() => setDecision('approved')}
                    >
                      <Check size={14} />
                      <span>Approve & Activate</span>
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.825rem' }}
                      onClick={() => setDecision('rejected')}
                    >
                      <X size={14} />
                      <span>Reject</span>
                    </button>
                  </div>
                )}

                {decision === 'approved' && (
                  <div style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Check size={15} />
                    Parser APPROVED & Activated into /parsers/custom-app-auth.yaml.
                  </div>
                )}

                {decision === 'rejected' && (
                  <div style={{ color: '#f87171', fontFamily: 'var(--font-mono)', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <X size={15} />
                    Candidate Rejected. Returned to Quarantine queue.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
