import React from 'react';

export default function Features() {
  const featureList = [
    {
      num: '01',
      title: 'Universal Parsing',
      desc: 'YAML-defined parsers support formats such as Cisco ASA, Fortinet and CEF while allowing custom parser definitions.',
    },
    {
      num: '02',
      title: 'Normalization',
      desc: 'Transform parsed fields into a consistent normalized event structure.',
    },
    {
      num: '03',
      title: 'Quarantine & Intelligence',
      desc: 'Unknown log formats are quarantined and grouped into structural clusters for AI-assisted parser generation.',
    },
    {
      num: '04',
      title: 'Full Traceability',
      desc: 'Trace events through ingestion, parsing, normalization, validation and export.',
    },
  ];

  return (
    <section id="features" className="section section-border-top">
      <div className="container">
        <div className="section-header text-center">
          <h2 className="section-title">One pipeline for every log.</h2>
          <p className="section-subtitle">
            Loki processes high-volume raw telemetry streams, resolving format variations and transforming un-structured logs into enterprise security intelligence.
          </p>
        </div>

        <div className="grid-4">
          {featureList.map((item) => (
            <div key={item.num} className="card">
              <span className="card-number">{item.num} —</span>
              <h3 className="card-title">{item.title}</h3>
              <p className="card-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
