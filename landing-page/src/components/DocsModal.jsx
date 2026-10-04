import React from 'react';
import { X, Terminal, BookOpen, Activity } from 'lucide-react';
import CopyButton from './CopyButton';

export default function DocsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>
          <X size={15} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
          <BookOpen size={18} style={{ color: '#ffffff' }} />
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
              Loki Architecture & Developer Reference
            </h3>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              Unified Log Processing Framework v1.0 • Node.js / Express / Elasticsearch / Ollama
            </div>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--border-subtle)', margin: '1rem 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* API Endpoints */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Terminal size={15} />
              CORE HTTP API ENDPOINTS
            </h4>

            <table className="docs-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Endpoint</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="port-badge">POST</span></td>
                  <td><code>/api/logs</code></td>
                  <td>Ingest raw log batch payload</td>
                </tr>
                <tr>
                  <td><span className="port-badge">GET</span></td>
                  <td><code>/api/health</code></td>
                  <td>Check system & Elasticsearch connectivity status</td>
                </tr>
                <tr>
                  <td><span className="port-badge">GET</span></td>
                  <td><code>/api/events/live</code></td>
                  <td>Server-Sent Events (SSE) live event stream</td>
                </tr>
                <tr>
                  <td><span className="port-badge">GET</span></td>
                  <td><code>/api/quarantine</code></td>
                  <td>Fetch quarantined unparsed logs & structural clusters</td>
                </tr>
                <tr>
                  <td><span className="port-badge">POST</span></td>
                  <td><code>/api/intelligence/analyze</code></td>
                  <td>Trigger local Ollama + Gemma candidate parser generation</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Quick Setup Scripts */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font-mono)', marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={15} />
              SETUP COMMAND REPOSITORY
            </h4>

            <div className="node-code-preview" style={{ position: 'relative' }}>
              <CopyButton textToCopy={`docker compose up -d\nnpm install\nnpm run setup-indices\nnpm run setup-dashboard\nnpm start`} style={{ position: 'absolute', right: '0.65rem', top: '0.65rem' }} />
              <pre>{`# 1. Start Infrastructure
docker compose up -d

# 2. Setup Indices & Kibana Data Views
npm install
npm run setup-indices
npm run setup-dashboard

# 3. Start Node Framework Server
npm start

# 4. (Optional) Run Live Terminal TUI & Simulator
node cli-dashboard/dashboard.js
python log-simulator/simulator.py`}</pre>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '0.45rem 1.15rem', fontSize: '0.825rem' }}>
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
}
