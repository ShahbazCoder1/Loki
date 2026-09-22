import React from 'react';

export default function Architecture() {
  return (
    <section id="architecture" className="section alt-bg">
      <div className="container text-center">
        <div className="section-tag">ARCHITECTURE PIPELINE</div>
        <h2 className="section-title">End-to-end pipeline</h2>
        
        <div className="arch-diagram-container">
          <div className="arch-flow">
            <div className="arch-node">Raw Log</div>
            <div className="arch-arrow">→</div>
            <div className="arch-node">Receiver</div>
            <div className="arch-arrow">→</div>
            <div className="arch-group">
              <div className="arch-node">Source Resolver</div>
              <div className="arch-branches">
                <div className="arch-branch">
                  <div className="arch-arrow-down">↓</div>
                  <div className="arch-node red">Quarantine</div>
                </div>
                <div className="arch-branch">
                  <div className="arch-arrow-down">↓</div>
                  <div className="arch-node red">AI Analysis</div>
                </div>
              </div>
            </div>
            <div className="arch-arrow">→</div>
            <div className="arch-node">Parser Engine</div>
            <div className="arch-arrow">→</div>
            <div className="arch-node">Normalizer</div>
            <div className="arch-arrow">→</div>
            <div className="arch-node">Schema Validator</div>
            <div className="arch-arrow">→</div>
            <div className="arch-group">
              <div className="arch-node">Exporter</div>
            </div>
            <div className="arch-arrow">→</div>
            <div className="arch-group">
              <div className="arch-node green">Elasticsearch</div>
              <div className="arch-branches right-align">
                <div className="arch-branch">
                  <div className="arch-arrow-down">↓</div>
                  <div className="arch-node green">Kibana</div>
                </div>
                <div className="arch-branch">
                  <div className="arch-arrow-down">↓</div>
                  <div className="arch-node green">Grafana</div>
                </div>
                <div className="arch-branch">
                  <div className="arch-arrow-down">↓</div>
                  <div className="arch-node green">TUI</div>
                </div>
              </div>
            </div>
          </div>
          <div className="arch-legend">
            <span><span className="dot dot-red"></span> Investigate / Reject</span>
            <span><span className="dot dot-green"></span> Output / Visualization</span>
          </div>
        </div>
      </div>
    </section>
  );
}
