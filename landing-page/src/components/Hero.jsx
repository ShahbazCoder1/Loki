import React, { useState } from 'react';
import { ArrowRight, Layers, Terminal as TerminalIcon } from 'lucide-react';
import CopyButton from './CopyButton';

export default function Hero() {
  const [activeTab, setActiveTab] = useState('setup');

  const setupCode = `git clone https://github.com/ShahbazCoder1/Loki.git
cd Loki
docker compose up -d
npm install
npm run setup-indices
npm run setup-dashboard
npm start`;

  const tuiCode = `node cli-dashboard/dashboard.js`;

  const simCode = `python log-simulator/simulator.py`;

  const currentCode = activeTab === 'setup' ? setupCode : activeTab === 'tui' ? tuiCode : simCode;

  return (
    <section className="hero-section">
      <div className="container">
        <div className="hero-grid">
          {/* LEFT SIDE: Content */}
          <div className="hero-left">
            <div className="hero-eyebrow">
              <span className="pulse-dot"></span>
              OPEN SOURCE • SECURITY LOG PIPELINE
            </div>

            <h1 className="hero-title">
              Turn raw security logs<br />
              into structured intelligence.
            </h1>

            <p className="hero-subtitle">
              Loki is a universal log pre-processing framework that ingests, parses, normalizes, validates, and exports security logs from different devices and formats.
            </p>

            <div className="btn-group">
              <a href="#docs" className="btn btn-primary">
                <span>Get Started</span>
                <ArrowRight size={15} />
              </a>
              <a href="#pipeline" className="btn btn-secondary">
                <Layers size={15} />
                <span>View Architecture</span>
              </a>
            </div>
          </div>

          {/* RIGHT SIDE: Real Installation Terminal Panel */}
          <div className="hero-right">
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="terminal-dot"></span>
                  <span className="terminal-dot"></span>
                  <span className="terminal-dot"></span>
                </div>

                <div className="terminal-title">
                  <TerminalIcon size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>Loki Setup</span>
                </div>

                <CopyButton textToCopy={currentCode} />
              </div>

              {/* Terminal Tabs */}
              <div className="terminal-tabs">
                <button
                  type="button"
                  className={`terminal-tab ${activeTab === 'setup' ? 'active' : ''}`}
                  onClick={() => setActiveTab('setup')}
                >
                  Local Stack Setup
                </button>
                <button
                  type="button"
                  className={`terminal-tab ${activeTab === 'tui' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tui')}
                >
                  TUI Dashboard
                </button>
                <button
                  type="button"
                  className={`terminal-tab ${activeTab === 'sim' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sim')}
                >
                  Log Simulator
                </button>
              </div>

              <div className="terminal-body">
                {activeTab === 'setup' && (
                  <>
                    <span className="terminal-comment"># Clone repository & launch infrastructure</span>
                    <div className="terminal-line">
                      <span className="terminal-prompt">$</span>
                      <span className="terminal-cmd">git clone https://github.com/ShahbazCoder1/Loki.git</span>
                    </div>
                    <div className="terminal-line">
                      <span className="terminal-prompt">$</span>
                      <span className="terminal-cmd">cd Loki && docker compose up -d</span>
                    </div>

                    <span className="terminal-comment" style={{ marginTop: '0.6rem' }}># Initialize indices & Kibana dashboards</span>
                    <div className="terminal-line">
                      <span className="terminal-prompt">$</span>
                      <span className="terminal-cmd">npm install && npm run setup-indices</span>
                    </div>
                    <div className="terminal-line">
                      <span className="terminal-prompt">$</span>
                      <span className="terminal-cmd">npm run setup-dashboard</span>
                    </div>

                    <span className="terminal-comment" style={{ marginTop: '0.6rem' }}># Start Loki framework server</span>
                    <div className="terminal-line">
                      <span className="terminal-prompt">$</span>
                      <span className="terminal-cmd">npm start</span>
                    </div>
                    <div className="terminal-output">
                      Loki running on <span className="terminal-url">http://localhost:3000</span>
                    </div>
                  </>
                )}

                {activeTab === 'tui' && (
                  <>
                    <span className="terminal-comment"># Open real-time terminal hacker UI (Terminal 2)</span>
                    <div className="terminal-line">
                      <span className="terminal-prompt">$</span>
                      <span className="terminal-cmd">node cli-dashboard/dashboard.js</span>
                    </div>
                    <div className="terminal-output">
                      ● Live Event Stream • Throughput Gauge • Source Distribution
                    </div>
                    <div className="terminal-output-muted">
                      Press 'q' or 'Esc' to exit terminal UI
                    </div>
                  </>
                )}

                {activeTab === 'sim' && (
                  <>
                    <span className="terminal-comment"># Stream synthetic + Windows logs (Terminal 3)</span>
                    <div className="terminal-line">
                      <span className="terminal-prompt">$</span>
                      <span className="terminal-cmd">python log-simulator/simulator.py</span>
                    </div>
                    <div className="terminal-output">
                      ● Streaming Cisco ASA, Fortinet & CEF to POST /api/logs
                    </div>
                    <div className="terminal-output-muted">
                      [200 OK] Batch ingested continuously
                    </div>
                  </>
                )}
              </div>

              <div className="terminal-status-bar">
                <span>Elasticsearch: 9200</span>
                <span>Kibana: 5601</span>
                <span>Loki API: 3000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
