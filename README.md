# Loki

**Loki** is a Unified Log Processing Framework (ULPF) for ingesting, parsing, normalizing, validating, enriching, and monitoring security and infrastructure logs.

It provides a Node.js/Express API, YAML-based parser definitions, Elasticsearch persistence, Kibana dashboards, a terminal dashboard, a Python log simulator, quarantine handling, dead-letter processing, field-level lineage, and optional AI-assisted parser intelligence.

## Features

- Ingest raw logs through an HTTP API
- Automatically resolve logs to the most appropriate parser
- Support Cisco ASA, Fortinet FortiGate, and generic CEF logs
- Define and hot-reload parsers using YAML
- Normalize vendor-specific fields into a common event structure
- Validate normalized events against a shared schema
- Preserve event provenance and field-level lineage
- Export successfully processed events to Elasticsearch
- Quarantine unknown or ambiguous log formats
- Route invalid events to a dead-letter index
- Cluster quarantined logs by structural fingerprint
- Generate, test, approve, and activate candidate parsers
- Analyze quarantined logs with optional Ollama/Gemma integration
- Stream live processing events through Server-Sent Events
- Monitor the system using Kibana dashboards or a terminal UI
- Generate realistic security logs with the Python simulator

## Architecture

```text
Raw Log
   │
   ▼
POST /api/logs
   │
   ▼
Receiver
   │
   ▼
Source Resolver
   │
   ├── Unknown / ambiguous ──► Quarantine
   │                             │
   │                             └── Optional AI analysis
   │
   ▼
Parser Engine
   │
   ▼
Normalizer
   │
   ▼
Schema Validator
   │
   ├── Validation failure ──► Dead Letter
   │
   ▼
Event Assembler
   │
   ▼
Elasticsearch Export
   │
   ├── Historical Events API
   ├── Field Lineage API
   ├── Kibana Dashboards
   └── Server-Sent Events Stream
```

## Technology Stack

- **Runtime:** Node.js with native ES modules
- **API:** Express
- **Search and storage:** Elasticsearch
- **Visualization:** Kibana
- **Terminal dashboard:** Blessed and Blessed Contrib
- **Parser definitions:** YAML
- **Log simulator:** Python 3 standard library
- **Testing:** Node.js built-in test runner
- **Optional AI integration:** Ollama

## Repository Structure

```text
.
├── cli-dashboard/                 # Terminal-based observability dashboard
├── config/
│   ├── schema.json                # Normalized event schema and allowed values
│   └── scoring.json               # Parser resolution scoring configuration
├── dashboards/
│   ├── seed-sample-events.js      # Seed sample events into the platform
│   ├── setup-kibana-dashboard.js  # Create Kibana data views and dashboards
│   └── ulpf-kibana-dashboard.ndjson
├── docs/                          # Project and implementation documentation
├── log-simulator/
│   ├── simulator.py               # Synthetic and host-log generator
│   └── README.md
├── modules/
│   ├── event-assembler.js         # Builds the complete event envelope
│   ├── event-bus.js               # In-process event emitter
│   ├── exporter.js                # Elasticsearch export operations
│   ├── field-lineage.js           # Tracks normalized field origins
│   ├── intelligence.js            # Quarantine clustering and AI workflows
│   ├── normalizer.js              # Converts parsed fields to normalized fields
│   ├── parser-engine.js           # Applies parser extraction rules
│   ├── parser-manager.js          # Loads and hot-reloads YAML parsers
│   ├── pipeline.js                # Main processing pipeline
│   ├── provenance.js              # Records processing-stage history
│   ├── receiver.js                # Creates event envelopes from raw logs
│   ├── schema-validator.js        # Validates normalized events
│   └── source-resolver.js         # Selects a parser using confidence scoring
├── parsers/                       # YAML parser definitions
├── public/                        # Static browser assets
├── routes/
│   ├── events.js                  # Historical events and lineage endpoints
│   ├── health.js                  # Health checks
│   ├── intelligence.js            # Parser intelligence endpoints
│   ├── logs.js                    # Raw log ingestion endpoint
│   ├── parsers.js                 # Parser management endpoints
│   ├── quarantine.js              # Quarantine event endpoints
│   └── stream.js                  # Server-Sent Events endpoint
├── scripts/
│   └── setup-indices.js           # Creates Elasticsearch indices
├── test-logs/                     # Sample log corpora
├── tests/                         # Unit, integration, and corpus tests
├── package.json
└── server.js                      # Express application and server entry point
```

## Processing Pipeline

The main pipeline is implemented in `modules/pipeline.js` and processes each log through these stages:

1. **Ingestion** – Creates an event envelope and records the raw payload.
2. **Source resolution** – Scores available parsers using signature, structural, and metadata signals.
3. **Parsing** – Extracts fields according to the selected YAML parser.
4. **Normalization** – Maps vendor-specific fields into the normalized event model.
5. **Validation** – Checks required fields, field types, and allowed enum values.
6. **Assembly** – Builds the complete event with source metadata and processing state.
7. **Export** – Writes successfully processed events to Elasticsearch.
8. **Observability** – Emits live events and preserves provenance and field lineage.

Parser resolution uses the following scoring configuration:

```json
{
  "signature": 0.40,
  "structural": 0.35,
  "metadata": 0.25
}
```

Logs below the configured confidence threshold, or logs with ambiguous parser matches, are quarantined instead of being silently discarded.

## Prerequisites

Install the following software:

- Node.js 20 or newer
- npm
- Python 3
- Elasticsearch running on `http://localhost:9200`
- Optional: Kibana running on `http://127.0.0.1:5601`
- Optional: Ollama running on `http://localhost:11434`

## Installation

```bash
git clone https://github.com/ShahbazCoder1/Loki.git
cd Loki
npm install
```

## Configuration

The server uses the following environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch endpoint |
| `ELASTICSEARCH_REQUEST_TIMEOUT_MS` | `3000` | Elasticsearch request timeout |
| `KIBANA_URL` | `http://127.0.0.1:5601` | Kibana endpoint used by dashboard setup |
| `ULPF_API_URL` | `http://127.0.0.1:3000/api/logs` | Log simulator ingestion endpoint |

## Running the Server

Start Loki with:

```bash
npm start
```

The API will be available at:

```text
http://localhost:3000
```

The server automatically loads parser definitions from the `parsers/` directory and watches for parser changes.

## Elasticsearch Setup

Create the required Elasticsearch indices:

```bash
node scripts/setup-indices.js
```

The setup creates:

- `ulpf-events`
- `ulpf-quarantine`
- `ulpf-deadletter`

## Sending a Log

Submit a raw log to the ingestion endpoint:

```bash
curl -X POST http://localhost:3000/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "raw": "%ASA-6-302013: Built inbound TCP connection 12345 for outside:10.0.0.5/1234 to inside:192.168.1.1/443"
  }'
```

A successfully processed event is normalized and exported to Elasticsearch.

Possible processing statuses include:

- `exported`
- `quarantined`
- `dead-letter`

## API Endpoints

### Health

```text
GET /api/health
```

### Log ingestion

```text
POST /api/logs
```

Request body:

```json
{
  "raw": "raw log message"
}
```

### Events

```text
GET /api/events
GET /api/events/:event_id/lineage
```

### Live event stream

```text
GET /api/stream
```

The stream uses Server-Sent Events and emits exported, quarantined, and dead-letter events.

### Parsers

```text
GET /api/parsers
```

Parser definitions are loaded from YAML files in the `parsers/` directory and automatically reloaded when changed.

### Quarantine and parser intelligence

```text
GET  /api/intelligence/candidates
POST /api/intelligence/cluster
POST /api/intelligence/generate
POST /api/intelligence/test
POST /api/intelligence/approve
POST /api/intelligence/reject
POST /api/intelligence/analyze
GET  /api/intelligence/status
```

## Supported Parser Definitions

The repository currently includes parser definitions for:

- Cisco ASA
- Fortinet FortiGate
- Generic ArcSight CEF

Parser files are stored in:

```text
parsers/
```

A parser can be added or updated without restarting the server. Loki watches the parser directory and refreshes the in-memory parser registry automatically.

## Log Simulator

The Python simulator generates realistic firewall, proxy, CEF, unknown, and host operating-system events.

Run the default stream mode:

```bash
python log-simulator/simulator.py
```

Change the interval between events:

```bash
python log-simulator/simulator.py 0.3
```

Send a burst of events:

```bash
python log-simulator/simulator.py burst 50
```

Run the guided demonstration mode:

```bash
python log-simulator/simulator.py demo
```

Set a custom ingestion endpoint:

```bash
ULPF_API_URL=http://127.0.0.1:3000/api/logs \
python log-simulator/simulator.py
```

## Terminal Dashboard

The terminal dashboard provides real-time monitoring without requiring a browser.

Start the Loki server first, then run:

```bash
node cli-dashboard/dashboard.js
```

The dashboard consumes the event stream and displays:

- Event throughput
- Exported events
- Quarantined events
- Dead-letter events
- Log source distribution
- Processing status
- Connection status
- Runtime information

## Kibana Dashboards

After Elasticsearch and Kibana are running, set up the saved objects and dashboards:

```bash
npm run setup-dashboard
```

This creates dashboards for:

1. **Security Overview**
2. **Quarantine & Intelligence**
3. **Event Inspector**

The setup script also generates:

```text
dashboards/ulpf-kibana-dashboard.ndjson
```

To seed sample events:

```bash
npm run seed-data
```

## Testing

Run the complete test suite:

```bash
npm test
```

The tests cover:

- Parser loading and hot reload
- Parser resolution
- Full pipeline processing
- Normalization and validation
- Event lineage and provenance
- Intelligence routes
- API routes
- Sample log validation
- Simulator behavior

Run tests directly with Node.js:

```bash
node --test tests/*.test.js
```

## Event Outcomes

### Exported events

Known log formats that parse successfully and pass schema validation are exported to:

```text
ulpf-events
```

### Quarantined events

Unknown or ambiguous log formats are stored in:

```text
ulpf-quarantine
```

Quarantined events retain their raw payload and structural fingerprint for later analysis and parser onboarding.

### Dead-letter events

Known logs that fail parser validation or normalized schema validation are stored in:

```text
ulpf-deadletter
```

Dead-letter records include the validation or processing error that caused the failure.

## Development

Start the server in development mode:

```bash
npm run dev
```

Create a feature branch:

```bash
git checkout -b feature/your-feature-name
```

Run tests before committing:

```bash
npm test
```

Keep parser definitions, schema changes, route changes, and tests synchronized when adding support for a new log source.

## CI

GitHub Actions runs the test suite against:

- Node.js 20
- Node.js 22

The workflow runs on pushes and pull requests targeting the `main` branch.

## License

This project currently uses the ISC license declared in `package.json`.
