# Loki

<div align="center">
  <img src="https://github.com/user-attachments/assets/38d9935c-41f3-47d7-9762-d7469e297050" alt="Loki logo" width="220" />
</div>

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Framework-Express-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Elasticsearch](https://img.shields.io/badge/Data-Elastic-005571?logo=elasticsearch&logoColor=white)](https://www.elastic.co/elasticsearch/)

Loki is a Unified Log Processing Framework (ULPF) for ingesting, parsing, normalizing, validating, enriching, and monitoring security and infrastructure logs.

It provides a Node.js/Express API, YAML-based parser definitions, Elasticsearch persistence, Kibana dashboards, a terminal dashboard, a Python log simulator, quarantine handling, and dead-letter processing for operational telemetry.

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
