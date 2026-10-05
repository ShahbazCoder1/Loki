# Loki Terminal Operations Suite (CLI & TUI)

The **Loki Terminal Operations Suite** provides a complete, terminal-native observability, forensic investigation, and governance toolkit for the Universal Log Pre-processing Framework (ULPF).

It is specifically designed for **non-browser-based systems**, including headless Linux servers, remote SSH sessions, air-gapped security operations centers (SOC), forensic analysis workstations, and restricted production environments where running a web browser or deploying Kibana is impossible, unauthenticated, or prohibited by security policy.

---

## Purpose and Role

While Loki integrates with Elasticsearch and Kibana for enterprise web analytics, security engineers frequently operate in headless or resource-constrained environments. The tools in this directory ensure that 100% of Loki's capabilities can be monitored and managed directly from the command line:

- **Browser-Independent Observability**: Operates entirely within the terminal using standard ANSI terminal escape sequences and blessed/blessed-contrib UI widgets.
- **Low Footprint**: Requires minimal CPU and memory overhead compared to web-based dashboards.
- **Air-Gapped & Offline Ready**: Functions locally without external network dependencies, communicating with the local Loki Express API and Server-Sent Events (SSE) stream.
- **End-to-End Operational Control**: Combines live event streaming (`dashboard.js`), forensic provenance tracing (`trace.js`), and AI candidate parser approval (`approve.js`) in a unified terminal ecosystem.

---

## Suite Components

```text
cli-dashboard/
├── dashboard.js   # Real-time TUI operations console (blessed-contrib)
├── trace.js       # Forensic event trace & cryptographic provenance inspection
└── approve.js     # Human-in-the-loop AI candidate parser review console
```

---

## 1. Terminal Operations Dashboard (`dashboard.js`)

A live, high-density terminal dashboard that streams incoming events, monitors processing throughput, and visualizes parser distribution in real time.

```text
+--------------------------------------------------------------------------+
| Loki Terminal Dashboard (TUI)                                            |
+------------------------------------+-------------------------------------+
| Live Event Stream                  | Throughput Gauge                    |
| [14:22:01] cisco_asa -> allowed    | [=========>         ] 18.4 events/s |
| [14:22:02] fortinet  -> denied     +-------------------------------------+
| [14:22:02] cef       -> allowed    | Source Distribution                 |
| [14:22:03] QUARANTINE: unknown     | Cisco: 42% | Forti: 35% | CEF: 23%  |
+------------------------------------+-------------------------------------+
| Status Counters                    | System Telemetry                    |
| Exported: 1,420 | Quarantined: 58  | Memory: 68 MB | Uptime: 01:24:10    |
+------------------------------------+-------------------------------------+
```

### Key Features
- **Live Event Table**: Displays recent normalized events with timestamps, parser source, and action disposition.
- **Throughput Gauge**: Measures real-time event ingestion rate per second.
- **Source Distribution**: Visualizes the breakdown of incoming traffic across Cisco ASA, Fortinet, CEF, and Quarantine.
- **Status Ledger**: Cumulative counters for successfully exported events, quarantined formats, and dead-letter validation failures.
- **System Telemetry**: Displays Node.js memory footprint, process uptime, and the number of active parsers loaded.

### Running the Dashboard

```bash
# Using the root .env configuration
node --env-file=.env cli-dashboard/dashboard.js

# Or with manual environment variable specification
ULPF_API_URL="http://localhost:3000" node cli-dashboard/dashboard.js
```

### Keyboard Controls
- `q` or `Esc`: Gracefully exit the dashboard.
- `Tab`: Cycle focus between dashboard panels.
- `Arrow Keys`: Scroll through tables or detailed views.
- `r`: Reset in-memory metric buffers.

---

## 2. Event Forensics Trace CLI (`trace.js`)

A command-line investigation tool used by security analysts and incident responders to audit the complete cryptographic provenance and field lineage of any processed event.

### Key Capabilities
- **Tamper-Evident Verification**: Validates the SHA-256 hash of the raw log against the stored cryptographic digest to prove forensic integrity.
- **Chronological Stage History**: Displays each discrete step in the event lifecycle (`ingest`, `resolve`, `parse`, `normalize`, `validate`, `export`) along with timestamps and component versions.
- **Raw Wire Log Inspection**: Displays the unaltered original payload exactly as received.
- **Granular Field Lineage**: Maps each normalized OCSF field back to its raw source key and transformation rule.
- **Resolution Telemetry**: Details the exact source resolution scoring, matched signatures, and confidence percentage.

### Running the Trace Tool

#### Interactive Selection Mode
Lists recent exported events in a numbered table and prompts for selection:

```bash
node --env-file=.env cli-dashboard/trace.js --list
```

#### Direct Event Lookup
Inspects a known event directly using its unique UUID:

```bash
node --env-file=.env cli-dashboard/trace.js 550e8400-e29b-41d4-a716-446655440000
```

### Sample Output

```text
================================================================================
EVENT FORENSIC TRACE: 550e8400-e29b-41d4-a716-446655440000
================================================================================
Status: EXPORTED | Timestamp: 2026-10-05T18:22:04.120Z
Integrity Digest (SHA-256): e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
Digest Verification: PASSED (Payload is unaltered)

Processing Lifecycle Ledger:
  1. [ingest]    receiver (v1.0)           -> SUCCESS (2026-10-05T18:22:04.050Z)
  2. [resolve]   source-resolver (v1.0)    -> SUCCESS (parser: cisco_asa_v1.0, conf: 0.95)
  3. [parse]     parser-engine (v1.0)      -> SUCCESS (8 fields extracted)
  4. [normalize] normalizer (v1.0)         -> SUCCESS (mapped to OCSF network_activity)
  5. [validate]  schema-validator (v1.0)   -> SUCCESS (0 contract violations)
  6. [export]    elasticsearch-exporter    -> SUCCESS (indexed in ulpf-events)

Field Lineage Mapping:
  src_endpoint.ip   <- src_ip (raw: 192.168.1.100, transform: direct_map)
  dst_endpoint.ip   <- dst_ip (raw: 203.0.113.50,  transform: direct_map)
  action            <- action (raw: Built,          transform: enum_remap -> allowed)

Raw Payload:
  %ASA-6-302013: Built outbound TCP connection 98214 for outside:203.0.113.50/443 to inside:192.168.1.100/51234
================================================================================
```

---

## 3. Candidate Parser Approval Console (`approve.js`)

A human-in-the-loop governance tool that connects security administrators to Loki's local AI synthesis loop (Ollama/Gemma). When unknown logs are clustered in quarantine, candidate YAML parsers are automatically drafted. This tool allows engineers to inspect, test, and activate them without opening a browser.

### Key Capabilities
- **Candidate Inventory**: Lists all pending AI-generated parsers awaiting approval.
- **Rule Inspection**: Displays detection signatures, extraction regex patterns, and normalization mappings.
- **Automated Validation Results**: Shows pass rates against positive and negative test fixtures from the quarantine cluster.
- **Zero-Downtime Deployment**: Approving a candidate writes the YAML file to `parsers/`, where the framework's hot-reload watcher loads it immediately.

### Running the Approval Console

#### Interactive Review Mode
Presents an interactive menu to browse candidates, inspect details, and make approval decisions:

```bash
node --env-file=.env cli-dashboard/approve.js
```

Inside interactive mode:
- `[A]pprove`: Approves the selected candidate and deploys it to the active parser engine.
- `[R]eject`: Rejects and discards the candidate definition.
- `[B]ack`: Returns to the candidate list.

#### Direct CLI Mode (Automated / Headless)
Approve or reject candidates programmatically in automated pipelines or headless maintenance scripts:

```bash
# Approve a candidate by ID
node --env-file=.env cli-dashboard/approve.js approve candidate_1728145200000

# Reject a candidate by ID
node --env-file=.env cli-dashboard/approve.js reject candidate_1728145200000
```

---

## Environment Configuration

All CLI tools read their target endpoint configuration from the environment:

| Variable | Default Value | Description |
|---|---|---|
| `ULPF_API_URL` | `http://localhost:3000` | Base URL of the Loki HTTP API |

To connect to a remote or containerized Loki server from a headless Linux bastion host:

```bash
export ULPF_API_URL="http://10.10.1.200:3000"

# Run any of the CLI tools
node cli-dashboard/dashboard.js
node cli-dashboard/trace.js --list
node cli-dashboard/approve.js
```