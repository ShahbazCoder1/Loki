import React from 'react';
import { Server, Database, Monitor, Box, Cpu, FileText, Code2 } from 'lucide-react';

export default function TechStack() {
  const stack = [
    { name: 'Node.js', role: 'Express Engine Runtime', icon: Server },
    { name: 'Elasticsearch 8.15', role: 'Persistent Security Event Store', icon: Database },
    { name: 'Kibana 8.15', role: 'Real-time Analytics Dashboards', icon: Monitor },
    { name: 'Docker', role: 'Container Orchestration & Compose', icon: Box },
    { name: 'Ollama', role: 'Local AI Model Host Runtime', icon: Cpu },
    { name: 'Gemma', role: 'Open LLM for Regex & Parser Synthesis', icon: Code2 },
    { name: 'YAML', role: 'Hot-Reloaded Parser Definition Specs', icon: FileText },
  ];

  return (
    <section className="section section-border-top reveal-section">
      <div className="container">
        <div className="section-header text-center">
          <h2 className="section-title">Built with practical infrastructure.</h2>
          <p className="section-subtitle">
            Loki relies on production-grade open-source infrastructure designed for high throughput log ingestion, elastic searchability, and local privacy.
          </p>
        </div>

        <div className="tech-badges" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.85rem' }}>
          {stack.map((item) => {
            const IconComp = item.icon;
            return (
              <div
                key={item.name}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div style={{ color: 'var(--text-main)' }}>
                  <IconComp size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                    {item.role}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
