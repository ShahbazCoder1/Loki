import React from 'react';

export default function ApiDocs() {
  return (
    <section id="api" className="section alt-bg">
      <div className="container text-center">
        <div className="section-tag">API ENDPOINTS</div>
        <h2 className="section-title">REST endpoints</h2>
        
        <div className="api-table-container">
          <table className="api-table">
            <thead>
              <tr>
                <th>METHOD</th>
                <th>ENDPOINT</th>
                <th>DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="method-badge post">POST</span></td>
                <td>/api/logs</td>
                <td>Ingest a raw log into the pipeline</td>
              </tr>
              <tr>
                <td><span className="method-badge get">GET</span></td>
                <td>/api/events</td>
                <td>List all exported events</td>
              </tr>
              <tr>
                <td><span className="method-badge get">GET</span></td>
                <td>/api/events/:id/full</td>
                <td>Full event envelope with traceability</td>
              </tr>
              <tr>
                <td><span className="method-badge get">GET</span></td>
                <td>/api/events/:id/lineage</td>
                <td>Field-level lineage for one event</td>
              </tr>
              <tr>
                <td><span className="method-badge get">GET</span></td>
                <td>/api/quarantine</td>
                <td>List quarantined events</td>
              </tr>
              <tr>
                <td><span className="method-badge get">GET</span></td>
                <td>/api/intelligence/candidates</td>
                <td>View AI-generated parser candidates</td>
              </tr>
              <tr>
                <td><span className="method-badge post">POST</span></td>
                <td>/api/intelligence/approve</td>
                <td>Approve a candidate parser</td>
              </tr>
              <tr>
                <td><span className="method-badge post">POST</span></td>
                <td>/api/intelligence/reject</td>
                <td>Reject a candidate parser</td>
              </tr>
              <tr>
                <td><span className="method-badge get">GET</span></td>
                <td>/api/health</td>
                <td>System health check</td>
              </tr>
              <tr>
                <td><span className="method-badge get">GET</span></td>
                <td>/api/stream</td>
                <td>Real-time event stream (SSE)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="api-base-url">Base URL: http://localhost:3000</div>
      </div>
    </section>
  );
}
