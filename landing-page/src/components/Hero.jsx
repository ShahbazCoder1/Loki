import React from 'react';
import CopyButton from './CopyButton';

export default function Hero() {
  const codeCommand = "git clone https://github.com/ShahbazCoder1/SIH-26156.git && cd SIH-26156 && docker compose up";

  return (
    <header className="hero">
      <div className="hero-content">
        <div className="hero-version"><span className="pulse-dot"></span> v1.0 - Now Available</div>
        <h1 className="hero-logo-text">Loki</h1>
        <h2 className="hero-title">Universal Log Pre-processing Framework</h2>
        <p className="hero-subtitle">One framework to ingest, parse, normalize, and export security logs from<br />any device.</p>
        
        <div className="hero-code-window">
          <div className="window-header">
            <div className="window-dots">
              <span className="dot close"></span>
              <span className="dot minimize"></span>
              <span className="dot maximize"></span>
            </div>
            <div className="window-title">bash</div>
          </div>
          <div className="window-body">
            <code>
              <span className="prompt">$</span> <span className="cmd-text">{codeCommand}</span>
            </code>
            <CopyButton textToCopy={codeCommand} style={{ position: 'absolute', right: '1rem', top: '1rem' }} />
          </div>
        </div>

        <div className="hero-actions">
          <a href="#features" className="btn btn-primary">Get Started</a>
        </div>
      </div>
    </header>
  );
}
