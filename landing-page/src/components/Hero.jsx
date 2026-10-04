import React from 'react';
import { Terminal as TerminalIcon, ChevronDown } from 'lucide-react';
import CopyButton from './CopyButton';

export default function Hero() {
  const singleCommand = "curl -fsSL https://bun.sh/install | bash";

  return (
    <section id="hero" className="hero-section reveal-section">
      <div className="container" style={{ width: '100%' }}>
        <div className="hero-grid">
          {/* LEFT SIDE: Content (Eyebrow, Title, Subtitle only - buttons removed) */}
          <div className="hero-left">
            <div className="hero-eyebrow">
              <span className="pulse-dot"></span>
              SECURITY LOG PIPELINE
            </div>

            <h1 className="hero-title">
              Turn raw security logs<br />
              into structured intelligence.
            </h1>

            <p className="hero-subtitle" style={{ marginBottom: 0 }}>
              Loki is a universal log pre-processing framework that ingests, parses, normalizes, validates, and exports security logs from different devices and formats.
            </p>
          </div>

          {/* RIGHT SIDE: Single Command Terminal Panel */}
          <div className="hero-right">
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <span className="terminal-dot red"></span>
                  <span className="terminal-dot yellow"></span>
                  <span className="terminal-dot green"></span>
                </div>

                <div className="terminal-title">
                  <TerminalIcon size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>Get Loki running</span>
                </div>

                <CopyButton textToCopy={singleCommand} />
              </div>

              <div className="terminal-body">
                <div className="terminal-line">
                  <span className="terminal-prompt">$</span>
                  <span className="terminal-cmd">{singleCommand}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Down Arrow Scroll Indicator (Desktop/Laptop View Only) */}
      <a
        href="#features"
        className="hero-scroll-down-desktop"
        aria-label="Scroll down to features"
      >
        <ChevronDown size={20} />
      </a>
    </section>
  );
}
