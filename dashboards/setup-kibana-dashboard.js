import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KIBANA_URL = process.env.KIBANA_URL || "http://127.0.0.1:5601";

// 1. Data Views (Index Patterns)
const indexPatterns = [
  {
    type: "index-pattern",
    id: "ulpf-events-pattern",
    attributes: {
      title: "ulpf-events*",
      timeFieldName: "received_at",
      name: "ulpf-events",
      fieldFormatMap: JSON.stringify({
        trace_url: {
          id: "url",
          params: {
            type: "a",
            urlTemplate: "{{rawValue}}",
            labelTemplate: "{{value}}",
            openInNewTab: true
          }
        }
      })
    }
  },
  {
    type: "index-pattern",
    id: "ulpf-quarantine-pattern",
    attributes: {
      title: "ulpf-quarantine*",
      timeFieldName: "received_at",
      name: "ulpf-quarantine",
      fieldFormatMap: JSON.stringify({
        structural_fingerprint: {
          id: "url",
          params: {
            type: "a",
            urlTemplate: "http://localhost:3000/review/{{rawValue}}",
            labelTemplate: "Review",
            openInNewTab: true
          }
        }
      })
    }
  },
  {
    type: "index-pattern",
    id: "ulpf-deadletter-pattern",
    attributes: {
      title: "ulpf-deadletter*",
      timeFieldName: "received_at",
      name: "ulpf-deadletter"
    }
  },
  {
    type: "index-pattern",
    id: "ulpf-all-pattern",
    attributes: {
      title: "ulpf-*",
      timeFieldName: "received_at",
      name: "ulpf-all"
    }
  }
];

// 2. Saved Searches
const searches = [
  {
    type: "search",
    id: "ulpf-search-recent-events",
    attributes: {
      title: "ULPF Recent Events Feed",
      description: "Recent processed security events from ulpf-events",
      columns: [
        "received_at",
        "source.type",
        "source.resolution_confidence",
        "normalized.severity_label",
        "normalized.action",
        "normalized.src_endpoint.ip",
        "normalized.dst_endpoint.ip",
        "normalized.dst_endpoint.port",
        "processing_status",
        "trace_url"
      ],
      sort: [["received_at", "desc"]],
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "search",
    id: "ulpf-search-quarantine-events",
    attributes: {
      title: "ULPF Quarantined Events Feed",
      description: "Unrecognized / ambiguous events waiting for onboarding or review",
      columns: [
        "received_at",
        "processing_status",
        "quarantine_reason",
        "structural_fingerprint",
        "raw.immutable_payload"
      ],
      sort: [["received_at", "desc"]],
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-quarantine-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "search",
    id: "ulpf-search-deadletter-events",
    attributes: {
      title: "ULPF Dead-Letter Events Feed",
      description: "Known parser matches that failed validation or processing",
      columns: [
        "received_at",
        "source.type",
        "dead_letter_error.message",
        "raw.immutable_payload"
      ],
      sort: [["received_at", "desc"]],
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-deadletter-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "search",
    id: "ulpf-search-event-inspector",
    attributes: {
      title: "ULPF Event Inspector",
      description: "Drill-down view for field-level lineage, provenance, and OCSF normalized fields",
      columns: [
        "event_id",
        "received_at",
        "source.type",
        "source.resolution_confidence",
        "parsed.parser_id",
        "parsed.parser_version",
        "parsed.validation_status",
        "normalized.event_class",
        "normalized.severity_label",
        "normalized.action",
        "normalized.src_endpoint.ip",
        "normalized.dst_endpoint.ip",
        "normalized.dst_endpoint.port",
        "processing_status",
        "trace_url"
      ],
      sort: [["received_at", "desc"]],
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  }
];

// 3. Visualizations
const visualizations = [
  // --- Dashboard 1: Security Overview Visualizations ---
  {
    type: "visualization",
    id: "ulpf-vis-total-events",
    attributes: {
      title: "Total Events",
      visState: JSON.stringify({
        title: "Total Events",
        type: "metric",
        aggs: [{ id: "1", enabled: true, type: "count", schema: "metric", params: { customLabel: "Total Logs Processed" } }]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-all-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-success-rate",
    attributes: {
      title: "Parse Success Rate",
      visState: JSON.stringify({
        title: "Parse Success Rate",
        type: "metric",
        aggs: [{ id: "1", enabled: true, type: "count", schema: "metric", params: { customLabel: "Successfully Parsed" } }]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-quarantine-count",
    attributes: {
      title: "Quarantined",
      visState: JSON.stringify({
        title: "Quarantined",
        type: "metric",
        aggs: [{ id: "1", enabled: true, type: "count", schema: "metric", params: { customLabel: "Quarantined Logs" } }]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-quarantine-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-deadletter-count",
    attributes: {
      title: "Dead-Letter",
      visState: JSON.stringify({
        title: "Dead-Letter",
        type: "metric",
        aggs: [{ id: "1", enabled: true, type: "count", schema: "metric", params: { customLabel: "Dead-Letter Errors" } }]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-deadletter-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-events-over-time-stacked",
    attributes: {
      title: "Events Over Time (Stacked)",
      visState: JSON.stringify({
        title: "Events Over Time (Stacked)",
        type: "histogram",
        params: { type: "histogram", mode: "stacked" },
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "date_histogram", schema: "segment", params: { field: "received_at", interval: "auto" } },
          { id: "3", enabled: true, type: "terms", schema: "group", params: { field: "_index", size: 5, order: "desc", orderBy: "1" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-all-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-events-by-source-hbar",
    attributes: {
      title: "Events by Source Type",
      visState: JSON.stringify({
        title: "Events by Source Type",
        type: "horizontal_bar",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "terms", schema: "segment", params: { field: "source.type.keyword", size: 10, order: "desc", orderBy: "1" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-confidence-distribution",
    attributes: {
      title: "Confidence Score Distribution",
      visState: JSON.stringify({
        title: "Confidence Score Distribution",
        type: "histogram",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "histogram", schema: "segment", params: { field: "source.resolution_confidence", interval: 0.05 } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-events-by-severity-hbar",
    attributes: {
      title: "Events by Severity",
      visState: JSON.stringify({
        title: "Events by Severity",
        type: "horizontal_bar",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "terms", schema: "segment", params: { field: "normalized.severity_label.keyword", size: 10, order: "desc", orderBy: "1" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-events-by-action-hbar",
    attributes: {
      title: "Events by Action",
      visState: JSON.stringify({
        title: "Events by Action",
        type: "horizontal_bar",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "terms", schema: "segment", params: { field: "normalized.action.keyword", size: 10, order: "desc", orderBy: "1" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-top-src-ips",
    attributes: {
      title: "Top Source IPs",
      visState: JSON.stringify({
        title: "Top Source IPs",
        type: "table",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "terms", schema: "bucket", params: { field: "normalized.src_endpoint.ip.keyword", size: 10, order: "desc", orderBy: "1" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-top-dst-ips",
    attributes: {
      title: "Top Destination IPs",
      visState: JSON.stringify({
        title: "Top Destination IPs",
        type: "table",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "terms", schema: "bucket", params: { field: "normalized.dst_endpoint.ip.keyword", size: 10, order: "desc", orderBy: "1" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-top-dst-ports",
    attributes: {
      title: "Top Destination Ports",
      visState: JSON.stringify({
        title: "Top Destination Ports",
        type: "table",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "terms", schema: "bucket", params: { field: "normalized.dst_endpoint.port", size: 10, order: "desc", orderBy: "1" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-events-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },

  // --- Dashboard 2: Quarantine & Intelligence Visualizations ---
  {
    type: "visualization",
    id: "ulpf-vis-quarantine-clusters-count",
    attributes: {
      title: "Unique Log Patterns (Clusters)",
      visState: JSON.stringify({
        title: "Unique Log Patterns (Clusters)",
        type: "metric",
        aggs: [
          { id: "1", enabled: true, type: "cardinality", schema: "metric", params: { field: "structural_fingerprint.keyword", customLabel: "Distinct Clusters" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-quarantine-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-quarantine-over-time",
    attributes: {
      title: "Quarantined Events Over Time",
      visState: JSON.stringify({
        title: "Quarantined Events Over Time",
        type: "histogram",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "date_histogram", schema: "segment", params: { field: "received_at", interval: "auto" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-quarantine-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-quarantine-reason-hbar",
    attributes: {
      title: "Quarantine Reason Breakdown",
      visState: JSON.stringify({
        title: "Quarantine Reason Breakdown",
        type: "horizontal_bar",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: {} },
          { id: "2", enabled: true, type: "terms", schema: "segment", params: { field: "quarantine_reason.keyword", size: 5, order: "desc", orderBy: "1" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-quarantine-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  },
  {
    type: "visualization",
    id: "ulpf-vis-quarantine-clusters-table",
    attributes: {
      title: "Unknown Log Clusters",
      visState: JSON.stringify({
        title: "Unknown Log Clusters",
        type: "table",
        aggs: [
          { id: "1", enabled: true, type: "count", schema: "metric", params: { customLabel: "Event Count" } },
          { id: "4", enabled: true, type: "terms", schema: "bucket", params: { field: "structural_fingerprint.keyword", size: 20, order: "desc", orderBy: "1" } }
        ]
      }),
      uiStateJSON: "{}",
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          index: "ulpf-quarantine-pattern",
          query: { query: "", language: "kuery" },
          filter: []
        })
      }
    }
  }
];

// 4. Dashboards

// --- Dashboard 1: Security Overview ---
const d1Panels = [
  // Row 1: KPIs
  { gridData: { x: 0, y: 0, w: 12, h: 6, i: "1" }, panelIndex: "1", panelRefName: "panel_1" },
  { gridData: { x: 12, y: 0, w: 12, h: 6, i: "2" }, panelIndex: "2", panelRefName: "panel_2" },
  { gridData: { x: 24, y: 0, w: 12, h: 6, i: "3" }, panelIndex: "3", panelRefName: "panel_3" },
  { gridData: { x: 36, y: 0, w: 12, h: 6, i: "4" }, panelIndex: "4", panelRefName: "panel_4" },
  // Row 2: Timeline
  { gridData: { x: 0, y: 6, w: 48, h: 10, i: "5" }, panelIndex: "5", panelRefName: "panel_5" },
  // Row 3: Source Intelligence
  { gridData: { x: 0, y: 16, w: 24, h: 12, i: "6" }, panelIndex: "6", panelRefName: "panel_6" },
  { gridData: { x: 24, y: 16, w: 24, h: 12, i: "7" }, panelIndex: "7", panelRefName: "panel_7" },
  // Row 4: Security Analytics
  { gridData: { x: 0, y: 28, w: 24, h: 12, i: "8" }, panelIndex: "8", panelRefName: "panel_8" },
  { gridData: { x: 24, y: 28, w: 24, h: 12, i: "9" }, panelIndex: "9", panelRefName: "panel_9" },
  // Row 5: Top Talkers
  { gridData: { x: 0, y: 40, w: 16, h: 12, i: "10" }, panelIndex: "10", panelRefName: "panel_10" },
  { gridData: { x: 16, y: 40, w: 16, h: 12, i: "11" }, panelIndex: "11", panelRefName: "panel_11" },
  { gridData: { x: 32, y: 40, w: 16, h: 12, i: "12" }, panelIndex: "12", panelRefName: "panel_12" },
  // Row 6: Recent Events Table
  { gridData: { x: 0, y: 52, w: 48, h: 15, i: "13" }, panelIndex: "13", panelRefName: "panel_13" }
];

const d1References = [
  { name: "panel_1", type: "visualization", id: "ulpf-vis-total-events" },
  { name: "panel_2", type: "visualization", id: "ulpf-vis-success-rate" },
  { name: "panel_3", type: "visualization", id: "ulpf-vis-quarantine-count" },
  { name: "panel_4", type: "visualization", id: "ulpf-vis-deadletter-count" },
  { name: "panel_5", type: "visualization", id: "ulpf-vis-events-over-time-stacked" },
  { name: "panel_6", type: "visualization", id: "ulpf-vis-events-by-source-hbar" },
  { name: "panel_7", type: "visualization", id: "ulpf-vis-confidence-distribution" },
  { name: "panel_8", type: "visualization", id: "ulpf-vis-events-by-severity-hbar" },
  { name: "panel_9", type: "visualization", id: "ulpf-vis-events-by-action-hbar" },
  { name: "panel_10", type: "visualization", id: "ulpf-vis-top-src-ips" },
  { name: "panel_11", type: "visualization", id: "ulpf-vis-top-dst-ips" },
  { name: "panel_12", type: "visualization", id: "ulpf-vis-top-dst-ports" },
  { name: "panel_13", type: "search", id: "ulpf-search-recent-events" }
];

const dashboardSecurityOverview = {
  type: "dashboard",
  id: "ulpf-security-overview-dashboard",
  attributes: {
    title: "ULPF - Security Overview",
    description: "Daily monitoring and security operations dashboard for perimeter devices",
    panelsJSON: JSON.stringify(d1Panels),
    optionsJSON: JSON.stringify({ hidePanelTitles: false, useMargins: true }),
    kibanaSavedObjectMeta: {
      searchSourceJSON: JSON.stringify({
        query: { query: "", language: "kuery" },
        filter: []
      })
    }
  },
  references: d1References
};

// --- Dashboard 2: Quarantine & Intelligence ---
const d2Panels = [
  // Row 1: KPIs
  { gridData: { x: 0, y: 0, w: 16, h: 6, i: "1" }, panelIndex: "1", panelRefName: "panel_1" },
  { gridData: { x: 16, y: 0, w: 16, h: 6, i: "2" }, panelIndex: "2", panelRefName: "panel_2" },
  { gridData: { x: 32, y: 0, w: 16, h: 6, i: "3" }, panelIndex: "3", panelRefName: "panel_3" },
  // Row 2: Timeline + Breakdown
  { gridData: { x: 0, y: 6, w: 28, h: 12, i: "4" }, panelIndex: "4", panelRefName: "panel_4" },
  { gridData: { x: 28, y: 6, w: 20, h: 12, i: "5" }, panelIndex: "5", panelRefName: "panel_5" },
  // Row 3: Clusters Table
  { gridData: { x: 0, y: 18, w: 48, h: 12, i: "6" }, panelIndex: "6", panelRefName: "panel_6" },
  // Row 4: Quarantined Feed
  { gridData: { x: 0, y: 30, w: 48, h: 14, i: "7" }, panelIndex: "7", panelRefName: "panel_7" },
  // Row 5: Dead-letter Feed
  { gridData: { x: 0, y: 44, w: 48, h: 12, i: "8" }, panelIndex: "8", panelRefName: "panel_8" }
];

const d2References = [
  { name: "panel_1", type: "visualization", id: "ulpf-vis-quarantine-count" },
  { name: "panel_2", type: "visualization", id: "ulpf-vis-quarantine-clusters-count" },
  { name: "panel_3", type: "visualization", id: "ulpf-vis-deadletter-count" },
  { name: "panel_4", type: "visualization", id: "ulpf-vis-quarantine-over-time" },
  { name: "panel_5", type: "visualization", id: "ulpf-vis-quarantine-reason-hbar" },
  { name: "panel_6", type: "visualization", id: "ulpf-vis-quarantine-clusters-table" },
  { name: "panel_7", type: "search", id: "ulpf-search-quarantine-events" },
  { name: "panel_8", type: "search", id: "ulpf-search-deadletter-events" }
];

const dashboardQuarantine = {
  type: "dashboard",
  id: "ulpf-quarantine-intelligence-dashboard",
  attributes: {
    title: "ULPF - Quarantine & Intelligence",
    description: "Handling unknown logs, cluster patterns, and AI parser candidates",
    panelsJSON: JSON.stringify(d2Panels),
    optionsJSON: JSON.stringify({ hidePanelTitles: false, useMargins: true }),
    kibanaSavedObjectMeta: {
      searchSourceJSON: JSON.stringify({
        query: { query: "", language: "kuery" },
        filter: []
      })
    }
  },
  references: d2References
};

// --- Dashboard 3: Event Inspector ---
const d3Panels = [
  { gridData: { x: 0, y: 0, w: 48, h: 32, i: "1" }, panelIndex: "1", panelRefName: "panel_1" }
];

const d3References = [
  { name: "panel_1", type: "search", id: "ulpf-search-event-inspector" }
];

const dashboardEventInspector = {
  type: "dashboard",
  id: "ulpf-event-inspector-dashboard",
  attributes: {
    title: "ULPF - Event Inspector",
    description: "Single event drill-down, field-level lineage, and provenance inspection",
    panelsJSON: JSON.stringify(d3Panels),
    optionsJSON: JSON.stringify({ hidePanelTitles: false, useMargins: true }),
    kibanaSavedObjectMeta: {
      searchSourceJSON: JSON.stringify({
        query: { query: "", language: "kuery" },
        filter: []
      })
    }
  },
  references: d3References
};

const allDashboards = [
  dashboardSecurityOverview,
  dashboardQuarantine,
  dashboardEventInspector
];

// Helper function to save an object to Kibana API
async function saveSavedObject(obj) {
  const url = `${KIBANA_URL}/api/saved_objects/${obj.type}/${obj.id}?overwrite=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "kbn-xsrf": "true"
    },
    body: JSON.stringify({
      attributes: obj.attributes,
      references: obj.references || []
    })
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to save ${obj.type}:${obj.id} - ${res.status}: ${errorText}`);
  }
  return res.json();
}

async function exportNdjsonFile(allObjects) {
  const ndjsonPath = path.join(__dirname, "ulpf-kibana-dashboard.ndjson");
  const lines = allObjects.map(obj => JSON.stringify(obj)).join("\n");
  fs.writeFileSync(ndjsonPath, lines + "\n", "utf-8");
  console.log(`Exported NDJSON file with ${allObjects.length} objects to: ${ndjsonPath}`);
}

export async function setupKibana() {
  console.log(`Connecting to Kibana at ${KIBANA_URL}...`);

  const allObjects = [
    ...indexPatterns,
    ...searches,
    ...visualizations,
    ...allDashboards
  ];

  try {
    // 1. Create Index Patterns
    for (const pat of indexPatterns) {
      try {
        await saveSavedObject(pat);
        console.log(`[Data View] Created: ${pat.attributes.name} (${pat.id})`);
      } catch (err) {
        console.warn(`[Data View] Kibana offline or warning for ${pat.id}: ${err.message}`);
      }
    }

    // 2. Create Saved Searches
    for (const search of searches) {
      try {
        await saveSavedObject(search);
        console.log(`[Search] Created: ${search.attributes.title} (${search.id})`);
      } catch (err) {
        console.warn(`[Search] Kibana offline or warning for ${search.id}: ${err.message}`);
      }
    }

    // 3. Create Visualizations
    for (const vis of visualizations) {
      try {
        await saveSavedObject(vis);
        console.log(`[Visualization] Created: ${vis.attributes.title} (${vis.id})`);
      } catch (err) {
        console.warn(`[Visualization] Kibana offline or warning for ${vis.id}: ${err.message}`);
      }
    }

    // 4. Create Dashboards
    for (const db of allDashboards) {
      try {
        await saveSavedObject(db);
        console.log(`[Dashboard] Created: ${db.attributes.title} (${db.id})`);
      } catch (err) {
        console.warn(`[Dashboard] Kibana offline or warning for ${db.id}: ${err.message}`);
      }
    }

    // 5. Generate NDJSON file (Always generates regardless of live Kibana connection)
    await exportNdjsonFile(allObjects);

    console.log("\n=======================================================");
    console.log("ULPF Kibana Dashboard Suite Setup Completed!");
    console.log("Dashboards Created:");
    console.log(`  1. Security Overview:        ${KIBANA_URL}/app/dashboards#/view/ulpf-security-overview-dashboard`);
    console.log(`  2. Quarantine & Intelligence: ${KIBANA_URL}/app/dashboards#/view/ulpf-quarantine-intelligence-dashboard`);
    console.log(`  3. Event Inspector:          ${KIBANA_URL}/app/dashboards#/view/ulpf-event-inspector-dashboard`);
    console.log("=======================================================");
  } catch (err) {
    console.error("Dashboard Setup Error:", err.message);
  }
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) setupKibana();
