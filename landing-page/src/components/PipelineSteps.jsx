import React from 'react';
import CopyButton from './CopyButton';

export default function PipelineSteps() {
  const step1Code = `git clone https://github.com/ShahbazCoder1/Loki.git
cd Loki
docker compose up -d`;
  
  const step2Code = `curl -X POST http://localhost:3000/api/logs \\
  -H "Content-Type: application/json" \\
  -d '{"raw": "%ASA-6-302013: Built outbound TCP connection..."}'`;

  const step3Code = `curl -s http://localhost:3000/api/events | jq '.'`;

  return (
    <section id="how-it-works" className="section">
      <div className="container">
        <div className="text-center">
          <div className="section-tag">HOW IT WORKS</div>
          <h2 className="section-title">Up and running in minutes</h2>
        </div>
        
        <div className="steps-container">
          <div className="step-item">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3 className="step-title">Clone & Boot</h3>
              <div className="code-box">
                <CopyButton textToCopy={step1Code} />
                <pre><code>
                  <span className="code-cmd">git clone</span> https://github.com/ShahbazCoder1/Loki.git<br/>
                  <span className="code-cmd">cd</span> Loki<br/>
                  <span className="code-cmd">docker compose up -d</span>
                </code></pre>
              </div>
              <p className="step-desc">Spins up the full cluster — Elasticsearch, Kibana, and the ULPF server — with sample configs loaded.</p>
            </div>
          </div>
          
          <div className="step-item">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3 className="step-title">Send a Log</h3>
              <div className="code-box">
                <CopyButton textToCopy={step2Code} />
                <pre><code>
                  <span className="code-cmd">curl -X POST</span> http://localhost:3000/api/logs \<br/>
                  &nbsp;&nbsp;-H <span className="code-string">"Content-Type: application/json"</span> \<br/>
                  &nbsp;&nbsp;-d <span className="code-string">{`'{"raw": "%ASA-6-302013: Built outbound TCP connection..."}'`}</span>
                </code></pre>
              </div>
              <p className="step-desc">Post raw logs directly to the ingestion API. The system automatically detects the source and parses it.</p>
            </div>
          </div>
          
          <div className="step-item">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3 className="step-title">Query Normalized Events</h3>
              <div className="code-box">
                <CopyButton textToCopy={step3Code} />
                <pre><code>
                  <span className="code-cmd">curl -s</span> http://localhost:3000/api/events | jq <span className="code-string">'.'</span>
                </code></pre>
              </div>
              <p className="step-desc">Query the processed events stream. Every returned record is cleanly mapped to OCSF schema fields, parsed, and tagged.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
