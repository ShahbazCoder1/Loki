import React from 'react';

export default function Architecture() {
  return (
    <section id="architecture" className="section section-border-top">
      <div className="container">
        <div className="section-header text-center">
          <div className="badge-tag">SYSTEM OVERVIEW</div>
          <h2 className="section-title">System Architecture</h2>
          <p className="section-subtitle">
            How Loki processes, analyzes, and exports security logs.
          </p>
        </div>

        <div className="arch-diagram-wrapper">
          <div className="arch-diagram-card">
            <img
              src="/ArDia.svg"
              alt="Loki System Architecture"
              className="arch-diagram-img"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

