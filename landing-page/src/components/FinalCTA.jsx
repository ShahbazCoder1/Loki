import React from 'react';
import { ArrowRight } from 'lucide-react';

const GithubIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function FinalCTA() {
  return (
    <section className="section section-border-top">
      <div className="container">
        <div className="section-header text-center" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ fontSize: '2.5rem' }}>
            Bring structure to your security logs.
          </h2>

          <p className="section-subtitle" style={{ maxWidth: '640px' }}>
            Loki turns heterogeneous security logs into normalized, traceable events while keeping unknown formats visible and reviewable.
          </p>
        </div>

        <div className="btn-group" style={{ justifyContent: 'center' }}>
          <a href="#docs" className="btn btn-primary">
            <span>Get Started</span>
            <ArrowRight size={15} />
          </a>
          
          <a
            href="https://github.com/ShahbazCoder1/Loki"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            <GithubIcon size={16} />
            <span>View on GitHub</span>
          </a>
        </div>
      </div>
    </section>
  );
}
