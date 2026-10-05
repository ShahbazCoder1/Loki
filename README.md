<div align="center">
  <img src="public/Loki.png" alt="Loki Logo" width="220" />
</div>

# Loki

[![Website](https://img.shields.io/badge/Website-loki.devloper.xyz-blue?logo=googlechrome&logoColor=white)](https://loki.devloper.xyz/)
[![Install](https://img.shields.io/badge/Install-Bash-4EAA25?logo=gnu-bash&logoColor=white)](https://loki.devloper.xyz/install.sh)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Framework-Express-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Elasticsearch](https://img.shields.io/badge/Data-Elasticsearch%208.15-005571?logo=elasticsearch&logoColor=white)](https://www.elastic.co/elasticsearch/)
[![Kibana](https://img.shields.io/badge/Analytics-Kibana%208.15-E8488B?logo=kibana&logoColor=white)](https://www.elastic.co/kibana/)

**Universal Log Pre-processing Framework (ULPF)**

A high-throughput, deterministic, provenance-aware security event ingestion, parsing, normalization, and intelligence platform.

Official Live Portal: [https://loki.devloper.xyz/](https://loki.devloper.xyz/)

---

## Executive Summary

Modern enterprises generate billions of log records every day across firewalls, intrusion detection systems, operating systems, cloud environments, containers, and identity providers. These logs arrive in heterogeneous, vendor-specific formats such as Syslog (RFC 3164 / RFC 5424), JSON, XML, CSV, Common Event Format (CEF), Log Event Extended Format (LEEF), and proprietary key-value structures.

This diversity introduces severe bottlenecks into security operations and data engineering:
- **Parser Fatigue**: Security operations and engineering teams expend hundreds of hours writing brittle, hardcoded regular expressions that break with every firmware or schema update.
- **Normalization Inconsistency**: Without an enforced schema, downstream SIEMs, data lakes, and detection models spend massive compute executing normalization queries at search time.
- **Lost Forensic Provenance**: Typical ingestion pipelines mutate or discard raw payloads, destroying the cryptographic audit trail needed during incident investigation and compliance verification.
- **The Quarantine Void**: Unrecognized or malformed log formats are either silently dropped or routed into unindexed dead-letter queues where they sit without actionable remediation.

Loki addresses Problem Statement 26156 by providing an end-to-end Universal Log Pre-processing Framework. It pairs lossless wire-log ingestion and deterministic source resolution with declarative YAML parsing, OCSF-aligned normalization, cryptographic SHA-256 provenance tracking, and an automated candidate parser synthesis loop powered by local large language models (Ollama/Gemma).

---

## Key Framework Capabilities

- **Lossless Ingestion**: Captures the raw byte stream verbatim, wrapping each record in an immutable envelope sealed with a SHA-256 cryptographic digest and a unique UUIDv4 identifier.
- **Deterministic Multi-Factor Source Resolver**: Scores incoming logs against known parser profiles using weighted signatures, structural pattern matching, and metadata heuristics to eliminate ambiguous classification.
- **Hot-Reloadable Declarative Parsers**: Encapsulates regex rules, delimiter tokenizers, and field validation in modular YAML files with zero-downtime file-system watchers.
- **OCSF Semantic Normalization**: Maps disparate vendor attributes (Cisco ASA, Fortinet FortiGate, CEF) into standardized Open Cybersecurity Schema Framework (OCSF) classes, endpoints, and dispositions.
- **Granular Field-Level Lineage**: Maintains an exact audit map detailing which raw field produced which normalized field and what transformation rule was applied.
- **Strict Schema Validation & Dead-Letter Routing**: Validates normalized payloads against strict data contracts (IPv4, ISO-8601 timestamps, enum values) and isolates non-compliant events into dedicated indices with full error telemetry.
- **Structural Fingerprinting & Clustering**: Strips volatile variables (IPs, MAC addresses, timestamps, ports, UUIDs) from unknown logs to cluster unseen formats into deterministic structural templates.
- **Local AI Candidate Parser Synthesis**: Automatically dispatches clustered unknown formats to an offline LLM (Ollama / Gemma) to draft candidate YAML parsers, test them against positive/negative fixtures, and stage them for review.
- **Human-in-the-Loop Governance**: Provides an interactive terminal interface (`approve.js`) and a web review portal (`/review/:cluster_id`) to inspect, test, approve, or reject AI-generated parsers.
- **End-to-End Observability**: Streams live pipeline metrics via Server-Sent Events (SSE) to a terminal UI (blessed-contrib), writes tiered data to Elasticsearch, and renders operational dashboards in Kibana.

---

## Live Demo

https://github.com/user-attachments/assets/13961dcf-9466-4676-b1df-e9fd84ba2937

---

## Framework Architecture

The framework is structured as an asynchronous, deterministic data processing pipeline with explicit state transitions and fault isolation.

```text
               +-------------------------------------------------------+
               |                  Incoming Wire Log                    |
               +-------------------------------------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |                    1. Ingestion                       |
               |  - Assign UUIDv4 event_id                             |
               |  - Compute SHA-256 integrity hash                     |
               |  - Seal into immutable envelope                       |
               +-------------------------------------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |                 2. Source Resolver                    |
               |  - Multi-factor scoring (signatures, structure, meta)  |
               |  - Check routing threshold (0.70) & margin (0.10)     |
               +-------------------------------------------------------+
                       |                                       |
          [Status: RESOLVED]                     [Status: UNKNOWN / AMBIGUOUS]
                       |                                       |
                       v                                       v
        +-----------------------------+         +-------------------------------+
        |      3. Parser Engine       |         |     Quarantine & AI Loop      |
        |  - Declarative YAML rules   |         |  - Structural fingerprinting  |
        |  - Regex / Key-Value parse  |         |  - Cluster unknown templates  |
        |  - Required field check     |         |  - Async Ollama/Gemma draft   |
        +-----------------------------+         |  - CLI / Web candidate review |
          |                         |           +-------------------------------+
       [PASS]                    [FAIL]                        |
          |                         |                          v
          v                         v                 Elasticsearch Index:
        +-------------------+  +------------------+   [ulpf-quarantine]
        |   4. Normalizer   |  |   Dead-Letter    |
        |  - OCSF taxonomy  |  |   - Log errors   |
        |  - Field lineage  |  |   - Quarantine   |
        +-------------------+  +------------------+
          |                             |
          v                             v
        +-------------------+  Elasticsearch Index:
        | 5. Schema Check   |  [ulpf-deadletter]
        |  - Type checking  |
        |  - Enum validation|
        +-------------------+
          |               |
       [VALID]        [INVALID] ---> [Route to Dead-Letter]
          |
          v
        +-------------------------------------------------------+
        |                  6. Event Assembler                   |
        |  - Build complete event document                      |
        |  - Append chronological provenance ledger             |
        |  - Attach trace URL (/trace/:event_id)                |
        +-------------------------------------------------------+
                                    |
                                    v
        +-------------------------------------------------------+
        |                 7. Export & Telemetry                 |
        |  - Elasticsearch: ulpf-events                         |
        |  - Server-Sent Events (SSE): /api/stream              |
        |  - Terminal Dashboard (blessed-contrib)               |
        |  - Kibana Security Visualizations                     |
        +-------------------------------------------------------+
```

---

## Detailed Pipeline Breakdown

### 1. Ingestion & Cryptographic Integrity
When a raw log hits `POST /api/logs`, the Receiver module wraps the payload into an immutable envelope. It computes a cryptographic SHA-256 digest of the raw string and assigns a globally unique `event_id`. This guarantees tamper evidence: if a forensic auditor compares the raw wire log to the normalized event years later, the hash verifies that the original evidence was never modified.

### 2. Deterministic Source Resolver
The Source Resolver evaluates the log against all registered parsers using a multi-factor scoring model:
```text
Score = (W_signature * S_signature) + (W_structural * S_structural) + (W_metadata * S_metadata)
```
- **Signatures (40% weight)**: Detects specific magic headers, syslog tags (such as `%ASA-` or `devname=FGT`), or format tokens (`CEF:`).
- **Structure (35% weight)**: Assesses structural patterns (syslog prefix, key-value delimiter patterns, pipe-separated CEF headers).
- **Metadata (25% weight)**: Evaluates port numbers, source hints, and keywords.

A parser is selected only if its confidence exceeds the routing threshold (0.70) and leads the second-best candidate by at least the winner margin (0.10). Logs failing these criteria are safely routed to Quarantine.

### 3. Declarative Parser Engine
Parsers are expressed entirely in declarative YAML files located in the `parsers/` directory. The framework watches this directory and hot-reloads parsers without requiring a process restart.

Each parser definition specifies:
- **Detection signatures and keywords** used by the resolver.
- **Extraction rules** using named regular expressions or key-value extractors.
- **Required field assertions** ensuring incomplete logs are flagged before normalization.
- **Normalization mapping** directing extracted vendor fields into canonical OCSF properties.

```yaml
parser_id: cisco_asa_v1.0
version: "1.0"
device_family: Cisco
description: "Cisco ASA firewall log parser"

detection:
  signatures:
    - "%ASA-"
  structure: "syslog_text"
  keywords:
    - "Built"
    - "Teardown"
    - "Deny"

extraction_rules:
  - field: "severity"
    regex: "%ASA-(\\d)-"
  - field: "message_id"
    regex: "%ASA-\\d-(\\d+)"
  - field: "action"
    regex: "\\b(Built|Teardown|Deny|Denied|denied|permitted)\\b"
  - field: "protocol"
    regex: "\\b(TCP|UDP|ICMP|tcp|udp|icmp)\\b"
  - field: "src_ip"
    regex: "(?:for|from|src)\\s+(?:[\\w-]+:)?(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})"
  - field: "src_port"
    regex: "(?:for|from|src)\\s+(?:[\\w-]+:)?\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/(\\d+)"
  - field: "dst_ip"
    regex: "(?:to|dst)\\s+(?:[\\w-]+:)?(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})"
  - field: "dst_port"
    regex: "(?:to|dst)\\s+(?:[\\w-]+:)?\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}/(\\d+)"

required_fields:
  - "src_ip"
  - "action"
  - "message_id"

normalization_mapping:
  src_ip: "src_endpoint.ip"
  dst_ip: "dst_endpoint.ip"
  src_port: "src_endpoint.port"
  dst_port: "dst_endpoint.port"
  action: "action"
  protocol: "protocol"
  message_id: "event_type"
  severity: "severity"
```

### 4. OCSF-Aligned Semantic Normalization
The Normalizer transforms vendor-specific vocabulary into standardized Open Cybersecurity Schema Framework attributes. For instance, Cisco actions like `Built` become `allowed`, while `Deny` and `Denied` map to `denied`. Fortinet firewall actions like `accept` and `close` map cleanly into canonical dispositions.

Concurrently, the module generates a `field_lineage` record:
```json
{
  "field_lineage": {
    "src_endpoint.ip": {
      "source_field": "src_ip",
      "transformation": "direct_map",
      "raw_value": "192.168.1.100"
    },
    "action": {
      "source_field": "action",
      "transformation": "enum_remap",
      "raw_value": "Built",
      "normalized_value": "allowed"
    }
  }
}
```

### 5. Schema Validation & Dead-Letter Isolation
Before indexing into Elasticsearch, the Schema Validator verifies all normalized fields against `config/schema.json`:
- **Mandatory properties**: `event_class`, `timestamp`, `action`.
- **Type compliance**: Valid IPv4 format, ISO-8601 date parsing, numeric port bounds (0-65535).
- **Controlled vocabularies**: Enforces allowed enum values for `action` (allowed, denied, dropped, closed, logged, reset) and `event_class` (network_activity, security_finding, system_activity).

Events that fail validation are routed directly to the `ulpf-deadletter` Elasticsearch index, annotated with the exact validation error list for rapid debugging.

### 6. Quarantine, Structural Fingerprinting & AI Synthesis Loop
When a log cannot be resolved by existing parsers, Loki executes an intelligent remediation loop:
1. **Structural Fingerprinting**: Replaces dynamic variables (IP addresses, timestamps, ports, MACs, UUIDs) with generic tokens (`<ip>`, `<timestamp>`, `<port>`), producing a normalized structural template.
2. **Cluster Grouping**: Computes a SHA-256 hash of the template to group similar unknown logs into clusters in `ulpf-quarantine`.
3. **Local AI Parser Generation**: Asynchronously sends representative log samples to a local LLM via Ollama (`gemma4:e2b`). The LLM analyzes the syntax, deduces field boundaries, and generates a candidate YAML parser.
4. **Autonomous Test Execution**: Evaluates the candidate parser against stored cluster logs, calculating a test pass rate and validating that required fields are extracted.
5. **Human Governance**: Operators inspect candidates using the CLI approval tool (`cli-dashboard/approve.js`) or web portal (`/review/:cluster_id`). Approving a candidate writes the YAML file to `parsers/`, where the watcher activates it in real time with zero downtime.

### 7. Provenance Ledger & Traceability
Every event document stored in `ulpf-events` carries a complete `provenance` audit ledger recording each stage in the processing lifecycle:
- Ingestion timestamp and component version
- Source resolver confidence and matched criteria
- Parser ID and extraction runtime
- Normalization mapping and lineage references
- Schema validation status
- Elasticsearch export status

Each record also includes a direct `trace_url` (such as `http://localhost:3000/trace/<event_id>`) for instant inspection in the web browser or terminal.

---

## Interactive Interfaces

### 1. Terminal Operations Dashboard (TUI)
Built with `blessed` and `blessed-contrib`, the terminal dashboard provides a high-density, real-time command center:
- **Event Feed Table**: Scrolling real-time stream of incoming events with timestamp, source parser, and disposition.
- **Throughput Gauge**: Live events-per-second processing speed.
- **Source Breakdown Donut**: Distribution of traffic across Cisco ASA, Fortinet, CEF, and Quarantine.
- **Status Ledger**: Cumulative counters for Exported, Quarantined, and Dead-Letter events.
- **System Telemetry**: Memory consumption, uptime, and active parser count.

Launch command:
```bash
node --env-file=.env cli-dashboard/dashboard.js
```

### 2. Event Forensics Trace CLI
Allows incident response teams to inspect the full cryptographic lineage of any event:
```bash
# List recent events
node --env-file=.env cli-dashboard/trace.js --list

# Inspect a specific event by ID
node --env-file=.env cli-dashboard/trace.js <event_id>
```

### 3. Parser Candidate Approval CLI
Allows security engineers to review and activate AI-generated parser candidates:
```bash
# Interactive review mode
node --env-file=.env cli-dashboard/approve.js

# Direct CLI approval or rejection
node --env-file=.env cli-dashboard/approve.js approve <candidate_id>
node --env-file=.env cli-dashboard/approve.js reject <candidate_id>
```

### 4. Web Trace & Cluster Review Interfaces
- **Interactive Trace Visualizer**: `http://localhost:3000/trace/:event_id` renders the raw log, parsed fields, normalized schema, and cryptographic provenance graph.
- **Cluster Review Portal**: `http://localhost:3000/review/:cluster_id` displays clustered unknown logs and pending candidate parser proposals.

### 5. Kibana Security Dashboards
Pre-configured dashboards provide visual analytics for enterprise security operations:
- Event volume trends over time
- Source device distribution
- Top source and destination IP addresses
- Threat and firewall action distribution (allowed vs. denied)
- Full-text search over normalized OCSF attributes

---

## Quick Install

To install Loki using our automated bootstrap script:

```bash
curl -fsSL https://loki.devloper.xyz/install.sh | bash
```

---

## Configuration Reference

Loki is configured using environment variables defined in a `.env` file in the project root:

```env
PORT=3000
ULPF_API_URL=http://localhost:3000
ULPF_LOG_API_URL=http://localhost:3000/api/logs
ULPF_SERVER_URL=http://localhost:3000
KIBANA_URL=http://127.0.0.1:5601
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_REQUEST_TIMEOUT_MS=3000
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=gemma4:e2b
OLLAMA_TIMEOUT_MS=300000
ULPF_BASE_URL=http://localhost:3000
```

### Environment Variables Detail

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `3000` | Port on which the Loki Express application listens. |
| `ULPF_API_URL` | `http://localhost:3000` | Base API URL used by CLI dashboards and external clients. |
| `ULPF_LOG_API_URL` | `http://localhost:3000/api/logs` | Ingestion endpoint target for log forwarders and simulators. |
| `ULPF_SERVER_URL` | `http://localhost:3000` | Internal server reference for module communication. |
| `KIBANA_URL` | `http://127.0.0.1:5601` | URL for the Kibana analytics and dashboard instance. |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Connection URL for the Elasticsearch 8.15 cluster. |
| `ELASTICSEARCH_REQUEST_TIMEOUT_MS` | `3000` | Network request timeout for Elasticsearch operations in milliseconds. |
| `OLLAMA_URL` | `http://localhost:11434/api/generate` | Local Ollama API endpoint for AI candidate parser generation. |
| `OLLAMA_MODEL` | `gemma4:e2b` | Local LLM model identifier used for parsing unknown logs. |
| `OLLAMA_TIMEOUT_MS` | `300000` | Timeout for local LLM inference generation in milliseconds. |
| `ULPF_BASE_URL` | `http://localhost:3000` | Public base URL used to construct event trace links. |

---

## Getting Started: Step-by-Step Walkthrough

Follow these steps to run the complete Loki framework locally.

### Infrastructure & Port Allocation

| Component | Technology | URL / Interface | Default Port |
|---|---|---|---|
| **Database** | Elasticsearch 8.15 | `http://localhost:9200` | `9200` |
| **Analytics UI** | Kibana 8.15 | `http://localhost:5601` | `5601` |
| **Loki Core Engine** | Node.js / Express | `http://localhost:3000` | `3000` |
| **Terminal Operations Console** | blessed-contrib | Terminal | Console |
| **Log Traffic Simulator** | Python 3 | Terminal | Console |

---

### Step 1: Start Elasticsearch & Kibana (Docker)

Launch the persistence layer using Docker Compose:

```bash
docker compose up -d
```

Verify that both containers are running and healthy:

```bash
docker ps
```

Allow 30 to 45 seconds for Elasticsearch to complete its initialization.

---

### Step 2: Initialize Indices & Kibana Dashboards

Install project dependencies and configure the storage mappings:

```bash
# 1. Install Node.js packages
npm install

# 2. Create Elasticsearch indices (ulpf-events, ulpf-quarantine, ulpf-deadletter)
npm run setup-indices

# 3. Provision Kibana data views, saved searches, and visualization dashboards
npm run setup-dashboard

# 4. (Optional) Populate baseline test events into Elasticsearch
npm run seed-data
```

---

### Step 3: Start the Loki Server (Terminal 1)

In your first terminal, launch the framework server:

```bash
npm start
```

Expected output:
```text
Loki Prototype running on http://localhost:3000
Watcher started on parsers directory
```

Verify server health at `http://localhost:3000/api/health`.

---

### Step 4: Launch the Live Terminal Dashboard (Terminal 2)

In a second terminal, open the live operations console:

```bash
node --env-file=.env cli-dashboard/dashboard.js
```

This starts the real-time TUI dashboard streaming events from `/api/stream`.
*(Press `q` or `Esc` to exit).*

---

### Step 5: Start the Enterprise Log Simulator (Terminal 3)

In a third terminal, initiate log generation:

```bash
python log-simulator/simulator.py
```

The simulator streams a realistic mix of security logs:
- Cisco ASA firewall connection events
- Fortinet FortiGate UTM security logs
- Common Event Format (CEF) IDS/IPS alerts
- Live host telemetry (Windows System Events via `wevtutil`)
- Unrecognized and zero-day logs to exercise the quarantine loop

---

### Step 6: View Analytics in Kibana

Open your web browser and navigate to:

```text
http://localhost:5601
```

1. Navigate to **Analytics -> Dashboard**.
2. Select **Loki - Security Overview**.
3. Set the refresh interval to **Auto-refresh: 5s** and the time filter to **Last 15 minutes**.

---

### Step 7: Forensic Trace an Event (Terminal 4)

In a fourth terminal, inspect event provenance:

```bash
# List recent events
node --env-file=.env cli-dashboard/trace.js --list

# Inspect a specific event by ID
node --env-file=.env cli-dashboard/trace.js <event_id>
```

The CLI outputs:
- Globally unique Event ID
- Chronological processing stage history
- Raw wire log verbatim
- SHA-256 integrity verification
- Source resolution score and parser match details
- Normalized OCSF fields
- Granular field-level lineage

---

### Step 8: Review & Approve AI Parser Candidates (Terminal 5)

In a fifth terminal, manage parser candidate synthesis:

```bash
node --env-file=.env cli-dashboard/approve.js
```

Select a candidate to review its extraction rules, test pass rates, and normalization mapping, then choose `[A]pprove` to deploy the parser dynamically to the active engine.

---

### Step 9: Stopping the Environment

To stop background containers and clean up:

```bash
docker compose down
```

---

## REST API Reference

The Loki HTTP server exposes the following endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/logs` | Ingests a raw log string or array of logs for real-time processing. |
| `GET` | `/api/events` | Queries normalized events from the `ulpf-events` Elasticsearch index. |
| `GET` | `/api/events/:id` | Retrieves a single normalized event by its UUID along with full provenance. |
| `GET` | `/api/quarantine` | Lists quarantined logs, cluster IDs, and failure reasons. |
| `GET` | `/api/intelligence/candidates` | Lists active AI-generated candidate parser definitions. |
| `POST` | `/api/intelligence/approve` | Approves and writes a candidate parser to the active `parsers/` directory. |
| `GET` | `/api/parsers` | Returns all currently active parsers loaded in memory. |
| `GET` | `/api/stream` | Server-Sent Events (SSE) feed streaming live pipeline events. |
| `GET` | `/api/health` | Health check endpoint returning status for server and Elasticsearch connectivity. |
| `GET` | `/trace/:event_id` | Interactive web visualizer for event provenance and field lineage. |
| `GET` | `/review/:cluster_id` | Interactive web visualizer for candidate parser cluster review. |

---

## Repository Structure

```text
SIH-26156/
├── cli-dashboard/             # Terminal operations and CLI tools
│   ├── dashboard.js           # Real-time blessed-contrib TUI dashboard
│   ├── trace.js               # CLI forensic event provenance inspection
│   └── approve.js             # CLI interactive parser candidate review
├── config/                    # System configurations and schemas
│   └── schema.json            # OCSF-aligned canonical event schema
├── dashboards/                # Kibana dashboard and data view definitions
├── log-simulator/             # Multi-vendor enterprise log generator
│   └── simulator.py           # Python streaming simulator
├── modules/                   # Core framework processing pipeline
│   ├── receiver.js            # Ingestion envelope creation & SHA-256 hashing
│   ├── source-resolver.js     # Multi-factor confidence scoring engine
│   ├── parser-engine.js       # Regex and tokenized field extraction
│   ├── parser-manager.js      # YAML loader with hot-reload directory watcher
│   ├── normalizer.js          # OCSF taxonomy mapper & field lineage recorder
│   ├── schema-validator.js    # Data contract and type enforcement
│   ├── event-assembler.js     # Final event document assembly
│   ├── provenance.js          # State machine and audit trail recorder
│   ├── intelligence.js        # Fingerprinting, clustering & Ollama AI synthesis
│   ├── exporter.js            # Tiered Elasticsearch index writer
│   ├── event-bus.js           # In-memory EventEmitter for live streaming
│   └── pipeline.js            # Pipeline orchestrator
├── parsers/                   # Declarative YAML parser definitions
│   ├── cisco_asa_v1.0.yaml    # Cisco ASA firewall rules
│   ├── fortinet_v1.0.yaml     # Fortinet FortiGate rules
│   └── generic_cef_v1.0.yaml  # Common Event Format rules
├── public/                    # Static assets & web dashboards
│   ├── Loki.png               # Framework logo
│   ├── trace.html             # Web-based trace visualizer
│   └── cluster-review.html    # Web-based cluster review interface
├── routes/                    # Express REST route handlers
├── scripts/                   # Setup and utility scripts
├── tests/                     # Unit and integration test suites
├── docker-compose.yml         # Container configuration for Elastic & Kibana
├── server.js                  # Application entry point
├── install.sh                 # One-line bash installation script
└── package.json               # Node.js project manifest
```
