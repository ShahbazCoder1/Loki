import React from 'react';
import { Terminal as TerminalIcon, ChevronDown } from 'lucide-react';
import CopyButton from './CopyButton';

export default function Hero() {
  const singleCommand = "cd Loki && docker compose up -d";

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
                <div className="terminal-dots" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="terminal-dot red" style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                  <span className="terminal-dot yellow" style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                  <span className="terminal-dot green" style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                </div>

                <div className="terminal-title">
                  <TerminalIcon size={13} style={{ color: 'var(--text-muted)' }} />
                  <span>Get Loki running</span>
                </div>

                <CopyButton textToCopy={singleCommand} />
              </div>

              <div className="terminal-body" style={{ minHeight: 'auto', padding: '1.25rem' }}>
                <div className="terminal-line" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: 0 }}>
                  <span className="terminal-prompt" style={{ flexShrink: 0 }}>$</span>
                  <span className="terminal-cmd" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>curl -fsSL https://bun.sh/install | bash</span>
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
