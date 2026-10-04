import React from 'react';
import { Shield } from 'lucide-react';

const GithubIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="footer reveal-section">
      <div className="container">
        <div className="footer-content">
          <div>
            <div className="footer-brand">
              <img src="/Loki.png" alt="Loki Logo" style={{ width: '24px', height: '24px', objectFit: 'contain', imageRendering: 'pixelated' }} />
              <span>LOKI</span>
            </div>
            <div className="footer-text" style={{ marginTop: '0.2rem' }}>
              Universal Log Pre-processing Framework 
            </div>
          </div>

          <ul className="footer-links">
            <li><a href="#features" className="footer-link">Features</a></li>
            <li><a href="#pipeline" className="footer-link">Pipeline</a></li>
            <li><a href="#formats" className="footer-link">Formats</a></li>
            <li><a href="#traceability" className="footer-link">Traceability</a></li>
            <li>
              <a
                href="https://github.com/ShahbazCoder1/Loki"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <GithubIcon size={14} />
                <span>GitHub</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
