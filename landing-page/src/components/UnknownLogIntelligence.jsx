import React from 'react';
import { Cpu, ShieldAlert, GitMerge, FileCode, CheckCircle2, AlertOctagon, UserCheck, Check } from 'lucide-react';

export default function UnknownLogIntelligence() {
  const flowSteps = [
    {
      step: '01',
      title: 'UNKNOWN LOG',
      desc: 'Raw log arrives with no matching YAML parser regex pattern.',
      icon: ShieldAlert,
    },
    {
      step: '02',
      title: 'QUARANTINE',
      desc: 'Log is preserved in ulpf-quarantine index for auditing.',
      icon: AlertOctagon,
    },
    {
      step: '03',
      title: 'STRUCTURAL CLUSTER',
      desc: 'Engine groups logs by structural fingerprint & regex token shape.',
      icon: GitMerge,
    },
    {
      step: '04',
      title: 'OLLAMA + GEMMA',
      desc: 'Local Ollama LLM analyzes cluster samples & synthesizes regex YAML.',
      icon: Cpu,
    },
    {
      step: '05',
      title: 'CANDIDATE PARSER',
      desc: 'Draft YAML parser generated with extractions & schema mappings.',
      icon: FileCode,
    },
    {
      step: '06',
      title: 'AUTOMATED VALIDATION',
      desc: 'Automated test suite executes candidate against sample log corpus.',
      icon: CheckCircle2,
    },
    {
      step: '07',
      title: 'HUMAN REVIEW',
      desc: 'Security analyst inspects test scorecard & side-by-side diff.',
      icon: UserCheck,
    },
    {
      step: '08',
      title: 'APPROVE / REJECT',
      desc: 'Approve activates YAML parser instantly; Reject requests feedback.',
      icon: Check,
    },
  ];

  return (
    <section id="intelligence" className="section section-border-top">
      <div className="container">
        <div className="section-header text-center">
          <h2 className="section-title">When Loki doesn't recognize a log.</h2>
          <p className="section-subtitle">
            Unknown formats don't disappear. Loki quarantines them, groups structurally similar events, and uses local AI-assisted parser generation for human review.
          </p>
        </div>

        {/* Visual Flow Diagram */}
        <div className="flow-diag-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#ffffff', fontWeight: 600 }}>
              RECOVERY & SYNTHESIS WORKFLOW
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.725rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.02)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              LOCAL INFERENCE • NO CLOUD DATA LEAKS
            </span>
          </div>

          <div className="flow-steps-grid">
            {flowSteps.slice(0, 4).map((s) => {
              const IconComp = s.icon;
              return (
                <div key={s.step} className="flow-step-item">
                  <div className="flow-step-icon">STEP {s.step}</div>
                  <IconComp size={20} style={{ color: 'var(--text-main)', margin: '0.4rem 0' }} />
                  <div className="flow-step-title">{s.title}</div>
                  <div className="flow-step-desc">{s.desc}</div>
                </div>
              );
            })}
          </div>

          <div className="flow-steps-grid">
            {flowSteps.slice(4, 8).map((s) => {
              const IconComp = s.icon;
              return (
                <div key={s.step} className="flow-step-item">
                  <div className="flow-step-icon">STEP {s.step}</div>
                  <IconComp size={20} style={{ color: s.step === '08' ? 'var(--accent-green)' : 'var(--text-main)', margin: '0.4rem 0' }} />
                  <div className="flow-step-title">{s.title}</div>
                  <div className="flow-step-desc">{s.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Local AI Details Callout */}
          <div style={{ background: 'var(--bg-terminal)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', color: '#ffffff', fontWeight: 600, fontSize: '0.875rem' }}>
                Powered by Local Ollama + Gemma Architecture
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.825rem', marginTop: '0.2rem' }}>
                Loki executes Gemma models locally via Ollama HTTP API (<code style={{ color: 'var(--text-main)' }}>http://localhost:11434</code>). Sensitive log samples remain strictly on-premise.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span className="score-chip">Ollama 0.3+</span>
              <span className="score-chip">Gemma 2B/7B</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
