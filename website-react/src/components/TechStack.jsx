import React from 'react';

export default function TechStack() {
  return (
    <section id="powered-by" className="section">
      <div className="container text-center">
        <div className="section-tag" style={{ color: 'var(--text-dim)' }}>POWERED BY</div>
        <div className="tech-badges">
          <span className="tech-badge">Node.js</span>
          <span className="tech-badge">Express</span>
          <span className="tech-badge">Elasticsearch</span>
          <span className="tech-badge">Kibana</span>
          <span className="tech-badge">Ollama / Gemma AI</span>
          <span className="tech-badge">Docker</span>
          <span className="tech-badge">OCSF Schema</span>
        </div>
      </div>
    </section>
  );
}
