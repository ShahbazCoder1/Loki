# Loki

<div align="center">
  <img src="public/Loki.png" alt="Loki logo" width="220" />
</div>

[![Website](https://img.shields.io/badge/Website-Loki-blue?logo=googlechrome&logoColor=white)](https://loki.devloper.xyz/)
[![Install](https://img.shields.io/badge/Install-Bash-4EAA25?logo=gnu-bash&logoColor=white)](https://loki.devloper.xyz/install.sh)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Framework-Express-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Elasticsearch](https://img.shields.io/badge/Data-Elastic-005571?logo=elasticsearch&logoColor=white)](https://www.elastic.co/elasticsearch/)

Loki is a Unified Log Processing Framework for ingesting, parsing, normalizing, validating, enriching, and monitoring security and infrastructure logs.

Visit our website at: [https://loki.devloper.xyz/](https://loki.devloper.xyz/)

It provides a Node.js/Express API, YAML-based parser definitions, Elasticsearch persistence, Kibana dashboards, a terminal dashboard, a Python log simulator, quarantine handling, and dead-letter processing for operational telemetry.

## Quick Install

To install Loki via our automated script, run:

```bash
curl -fsSL https://loki.devloper.xyz/install.sh | bash
```

## Configuration

Loki requires the following environment variables. Create a `.env` file in the root directory and add the following configuration:

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

## Demo Video

[//]: # (Add demo video link or embed here)
<br>
<br>

## Problem Statement

**Problem Statement ID:** 26156  
**Problem Statement Title:** Universal Log Pre-processing Framework  

This solution covers a universal event schema and processing framework that enables:

a) Preserve complete raw event data without information loss.  
b) Extract and parse source-specific attributes.  
c) Normalize fields into a common event taxonomy.  
d) Maintain traceability between normalized and original events.  
e) Plug-and-play on boarding of new log sources.  
f) Unified visibility across enterprise environments.  
g) Efficient SIEM and Data Lake integration.  
h) AI/ML-ready security and operational analytics.  
i) Reduced parser development effort.  
j) The solution shall be deployable in an air-gapped network.  
k) Solution may be packaged in a container for making it platform independent.  

Our proposed main solution is detailed in: [ULPF Project Blueprint](docs/loki_ulpf_project_blueprint.md).

---

## Features

- Ingest raw logs through an HTTP API
- Automatically resolve the most appropriate parser for each log
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
- Monitor the system with Kibana dashboards or a terminal UI
- Generate realistic security logs with the Python simulator

---

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

---

## Getting Started

Since Docker Desktop is running on your machine, you can spin up the entire stack with a few commands.

---

### Architecture & Port Mapping

| Component | Technology | URL / Command | Port |
|---|---|---|---|
| **Database** | Elasticsearch 8.15 | `http://localhost:9200` | `9200` |
| **Web Dashboard** | Kibana 8.15 | `http://localhost:5601` | `5601` |
| **Loki Server** | Node.js Express | `http://localhost:3000` | `3000` |
| **Terminal TUI** | blessed-contrib | `node cli-dashboard/dashboard.js` | Terminal |
| **Log Generator** | Python 3 | `python log-simulator/simulator.py` | Terminal |

---

### Step 1: Start Elasticsearch & Kibana (Docker)

In your project root, open PowerShell:

```powershell
docker compose up -d
```

> **Note**: This starts `loki-elasticsearch` and `loki-kibana` in the background. The first time you run this, Docker will download the images (~600MB). Wait about **30–45 seconds** for Elasticsearch to finish initializing.

Verify both containers are running:
```powershell
docker ps
```
You should see both `loki-elasticsearch` and `loki-kibana` with status `Up`.

---

### Step 2: Initialize Elasticsearch Indices & Kibana Dashboards

Install any missing npm packages and run the setup scripts:

```powershell
# 1. Install dependencies
npm install

# 2. Create the Elasticsearch indices (ulpf-events, ulpf-quarantine, ulpf-deadletter)
npm run setup-indices

# 3. Auto-configure Kibana data views, saved searches, and dashboards
npm run setup-dashboard

# 4. (Optional) Seed sample baseline events into Elasticsearch
npm run seed-data
```

---

### Step 3: Start the Loki Framework Server (Terminal 1)

Open **Terminal 1** and start the Node.js server:

```powershell
npm start
```
You will see:
```text
Loki Prototype running on http://localhost:3000
Watcher started on parsers directory
```

You can verify the system health in your browser at `http://localhost:3000/api/health`.

---

### Step 4: Open the Terminal Dashboard (TUI) (Terminal 2)

Open a **second terminal** and launch the live terminal dashboard:

```powershell
node --env-file=.env cli-dashboard/dashboard.js
```
This renders the real-time hacker terminal dashboard with:
- **Live Event Feed** (scrolling table of parsed OCSF events)
- **Throughput Gauge** (events/second)
- **Source Distribution** (Cisco ASA / Fortinet / CEF / Unknown)
- **Status Breakdown** (Exported / Quarantined / Dead-Letter)
- **System Telemetry**

*(Press `q` or `Esc` anytime to exit)*

---

### Step 5: Start the Log Simulator (Terminal 3)

Open a **third terminal** and start streaming logs into the framework:

```powershell
python log-simulator/simulator.py
```

This streams mixed synthetic logs + real laptop logs (`wevtutil System` events) into the framework every second.

You will immediately see:

1. Logs being ingested and parsed in **Terminal 1 (Server)**
2. Live metrics, gauges, and tables updating in **Terminal 2 (TUI Dashboard)**
3. Live colored stream status in **Terminal 3 (Simulator)**

---

### Step 6: View the Kibana Dashboard in Your Browser

Open your web browser and go to:

```text
http://localhost:5601
```

1. Navigate to **Analytics → Dashboard**.
2. Open **Loki - Security Overview** or any of the Loki sub-dashboards.
3. Set the time range to **Today** or **Last 15 minutes**.
4. Enable **Auto-refresh: 5s**.

You will see real-time charts, event maps, and the events table.

---

### Step 7: Trace an Event from the Terminal (Terminal 4)

Open a **fourth terminal** and list recent exported events:

```powershell
node --env-file=.env cli-dashboard/trace.js --list
```

Select an event from the numbered list.

To directly trace a known event:

```powershell
node --env-file=.env cli-dashboard/trace.js <event_id>
```

The CLI displays:

* Event ID
* Complete provenance chain
* Processing timestamps
* Original raw log
* SHA-256 integrity verification
* Field-level lineage
* Parser ID
* Parser confidence
* Source-resolution method

---

### Step 8: Review Parser Candidates (Terminal 5)

Open a **fifth terminal** and launch the parser approval workflow:

```powershell
node --env-file=.env cli-dashboard/approve.js
```

This lists pending AI-generated parser candidates.

Select a candidate to inspect:

* Candidate ID
* Device family
* Detection signatures
* Extraction rules
* Required fields
* Normalization mapping
* Positive test results
* Negative test results
* Overall pass rate

Then choose:

```text
[A]pprove / [R]eject / [B]ack?
```

---

### Step 9: Directly Approve or Reject a Candidate

To approve a known candidate without entering interactive mode:

```powershell
node --env-file=.env cli-dashboard/approve.js approve <candidate_id>
```

To reject a candidate:

```powershell
node --env-file=.env cli-dashboard/approve.js reject <candidate_id>
```

---

### Step 10: Stop the Docker Containers

When you are finished:

```powershell
docker compose down
```
