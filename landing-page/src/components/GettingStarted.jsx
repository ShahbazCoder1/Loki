import React from 'react';
import { BookOpen, Layers } from 'lucide-react';
import CopyButton from './CopyButton';

export default function GettingStarted({ onOpenDocs }) {
  const steps = [
    {
      num: '01',
      title: 'Spin Up Infrastructure (Docker)',
      desc: 'Starts loki-elasticsearch and loki-kibana containers in the background.',
      cmd: 'docker compose up -d',
    },
    {
      num: '02',
      title: 'Initialize Indices & Kibana Dashboards',
      desc: 'Installs dependencies and sets up index templates (ulpf-events, ulpf-quarantine, ulpf-deadletter) and Kibana data views.',
      cmd: 'npm install\nnpm run setup-indices\nnpm run setup-dashboard',
    },
    {
      num: '03',
      title: 'Start Loki Server (Terminal 1)',
      desc: 'Launches Node.js Express framework server on http://localhost:3000.',
      cmd: 'npm start',
    },
    {
      num: '04',
      title: 'Launch Terminal TUI & Log Generator',
      desc: 'Open live hacker TUI and stream continuous synthetic + Windows system logs.',
      cmd: 'node cli-dashboard/dashboard.js\npython log-simulator/simulator.py',
    },
  ];

  return (
    <section id="docs" className="section section-border-top">
      <div className="container">
        <div className="section-header text-center">
          <h2 className="section-title">Get Loki running locally.</h2>
          <p className="section-subtitle">
            Run Loki locally using Docker Desktop, Node.js 20+, and Python 3. Full infrastructure setup takes only a few shell commands.
          </p>
        </div>

        {/* Documentation Step Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '820px', margin: '0 auto 2.5rem' }}>
          {steps.map((step) => (
            <div key={step.num} className="card" style={{ padding: '1.25rem 1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="card-number" style={{ margin: 0 }}>{step.num} —</span>
                  <h3 className="card-title" style={{ margin: 0, fontSize: '1.025rem' }}>{step.title}</h3>
                </div>
                <CopyButton textToCopy={step.cmd} />
              </div>
              
              <p className="card-desc" style={{ marginBottom: '0.85rem', fontSize: '0.85rem' }}>
                {step.desc}
              </p>

              <div className="node-code-preview" style={{ background: '#060606', padding: '0.65rem 0.85rem' }}>
                <pre><span className="terminal-cmd">{step.cmd}</span></pre>
              </div>
            </div>
          ))}
        </div>

        {/* Service Port Mapping Table */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '1.75rem', maxWidth: '820px', margin: '0 auto 2.5rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.825rem', color: '#ffffff', fontWeight: 600, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={15} />
            LOCAL SERVICE PORT MAPPING
          </div>

          <table className="docs-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Technology</th>
                <th>URL / Command</th>
                <th>Port</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Elasticsearch 8.15</td>
                <td>Data Persistence</td>
                <td><code>http://localhost:9200</code></td>
                <td><span className="port-badge">9200</span></td>
              </tr>
              <tr>
                <td>Kibana 8.15</td>
                <td>Web Dashboard</td>
                <td><code>http://localhost:5601</code></td>
                <td><span className="port-badge">5601</span></td>
              </tr>
              <tr>
                <td>Loki Framework</td>
                <td>Node.js Express API</td>
                <td><code>http://localhost:3000</code></td>
                <td><span className="port-badge">3000</span></td>
              </tr>
              <tr>
                <td>Terminal Dashboard</td>
                <td>blessed-contrib TUI</td>
                <td><code>node cli-dashboard/dashboard.js</code></td>
                <td><span className="port-badge">Terminal</span></td>
              </tr>
              <tr>
                <td>Log Simulator</td>
                <td>Python 3</td>
                <td><code>python log-simulator/simulator.py</code></td>
                <td><span className="port-badge">Terminal</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* View Documentation CTA */}
        <div className="text-center">
          <button onClick={onOpenDocs} className="btn btn-outline-subtle">
            <BookOpen size={15} />
            <span>View Architecture Reference</span>
          </button>
        </div>
      </div>
    </section>
  );
}
