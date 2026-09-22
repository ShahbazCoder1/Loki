import React from 'react';

export default function Features() {
  return (
    <section id="features" className="section">
      <div className="container text-center">
        <div className="section-tag">FEATURES OVERVIEW</div>
        <h2 className="section-title">Built for real-world security ops</h2>
        <p className="section-subtitle">Every component designed to handle the chaos of production<br />log pipelines at scale.</p>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon"></div>
            <h3 className="feature-title">Universal Parsing</h3>
            <p className="feature-desc">YAML-defined parsers auto-detect Cisco ASA, Fortinet, CEF, and any custom log format via confidence-scored signature matching.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"></div>
            <h3 className="feature-title">AI Parser Generation</h3>
            <p className="feature-desc">Unknown log formats are quarantined and analyzed by Gemma AI (via Ollama) to auto-generate new parsers — with human-in-the-loop approval.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"></div>
            <h3 className="feature-title">Full Traceability</h3>
            <p className="feature-desc">Every normalized field traces back to the exact raw substring, extraction regex, and parser version. SHA-256 integrity hashing proves zero information loss.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"></div>
            <h3 className="feature-title">Dashboard Agnostic</h3>
            <p className="feature-desc">Exports OCSF-normalized events to Elasticsearch. Works with Kibana, Grafana, or any visualization tool out of the box.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"></div>
            <h3 className="feature-title">Real-Time Pipeline</h3>
            <p className="feature-desc">7-stage processing pipeline: Ingest → Resolve → Parse → Normalize → Validate → Assemble → Export. Sub-second latency.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"></div>
            <h3 className="feature-title">Quarantine & Dead Letter</h3>
            <p className="feature-desc">Unknown formats are quarantined for AI analysis. Malformed events go to dead-letter for forensic review. Zero events lost.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
