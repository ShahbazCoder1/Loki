import React from 'react';
import { BarChart3, AlertOctagon, Search, ExternalLink } from 'lucide-react';

export default function KibanaObservability() {
  const conceptualAreas = [
    {
      id: 'overview',
      title: 'SECURITY OVERVIEW',
      desc: 'Real-time telemetry on log ingestion throughput, vendor device distribution, and threat severity metrics.',
      icon: BarChart3,
      metrics: [
        { label: 'Throughput', val: '4,250 eps' },
        { label: 'Top Vendor', val: 'Cisco ASA (48%)' },
        { label: 'Normalized', val: '99.8%' },
      ],
      previewSnippet: `[Kibana Dashboard: Security Overview]
├── Ingestion Rate: 4.2k events/sec (Gauge)
├── Source Breakdown: Cisco ASA, Fortinet, CEF
└── Event Classification: 94% Info, 6% Warning`,
    },
    {
      id: 'quarantine',
      title: 'QUARANTINE & INTELLIGENCE',
      desc: 'Dedicated monitoring for unknown log streams, structural fingerprint clusters, and AI candidate parser scorecards.',
      icon: AlertOctagon,
      metrics: [
        { label: 'Quarantined', val: '14 events' },
        { label: 'Active Clusters', val: '2 patterns' },
        { label: 'AI Candidates', val: '1 review' },
      ],
      previewSnippet: `[Kibana Dashboard: Quarantine & Intelligence]
├── Active Quarantined Logs: 14 events
├── Structural Cluster: "custom-app-auth-cluster"
└── Candidate Generator: Gemma 7B (100% Score)`,
    },
    {
      id: 'inspector',
      title: 'EVENT INSPECTOR',
      desc: 'Deep-dive event audit interface for inspecting raw logs, parsed key-value trees, and field transformation provenance.',
      icon: Search,
      metrics: [
        { label: 'Indexed Events', val: '1.4M docs' },
        { label: 'Search Latency', val: '< 12ms' },
        { label: 'Lineage Audited', val: '100% trail' },
      ],
      previewSnippet: `[Kibana Dashboard: Event Inspector]
├── Event ID: evt-9041-x812
├── Raw Syslog: %ASA-6-302013: Built outbound...
└── Lineage: srcip ➔ source.ip (Validated)`,
    },
  ];

  return (
    <section id="observability" className="section section-border-top">
      <div className="container">
        <div className="section-header text-center">
          <h2 className="section-title">See what your pipeline is doing.</h2>
          <p className="section-subtitle">
            Loki automatically configures out-of-the-box Kibana dashboards (<code style={{ color: 'var(--text-main)' }}>http://localhost:5601</code>) and provides a terminal hacker UI for live operational awareness.
          </p>
        </div>

        {/* 3 Conceptual Areas */}
        <div className="grid-3">
          {conceptualAreas.map((area) => {
            const IconComp = area.icon;
            return (
              <div key={area.id} className="obs-card">
                <div className="obs-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <IconComp size={18} style={{ color: 'var(--text-main)' }} />
                    <span className="obs-card-title">{area.title}</span>
                  </div>
                </div>

                <p className="card-desc" style={{ marginBottom: '1.15rem' }}>
                  {area.desc}
                </p>

                {/* Lightweight Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '1.15rem', background: '#080808', padding: '0.65rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  {area.metrics.map((m, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: '#ffffff' }}>
                        {m.val}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preview Snippet */}
                <div className="node-code-preview" style={{ fontSize: '0.725rem', padding: '0.65rem' }}>
                  <pre>{area.previewSnippet}</pre>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dual Visualizer Info Strip */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '1.5rem 2rem', marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <div style={{ fontSize: '0.975rem', fontWeight: 600, color: '#ffffff' }}>
              Dual Monitoring Interfaces Included
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>
              Access full Kibana web analytics at <code style={{ color: 'var(--text-main)' }}>:5601</code> or run terminal dashboard via <code style={{ color: 'var(--text-main)' }}>node cli-dashboard/dashboard.js</code>.
            </div>
          </div>

          <a
            href="#docs"
            className="btn btn-outline-subtle"
            style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}
          >
            <span>Setup Dashboards</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </section>
  );
}
