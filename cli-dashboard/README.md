# ULPF Terminal Dashboard

The **ULPF Terminal Dashboard (TUI)** is a real-time terminal-based observability interface for the Universal Log Processing Framework (ULPF).

It provides a lightweight CLI presentation layer for monitoring log ingestion, processing, quarantine activity, source distribution, throughput, and system state without depending on a browser-based dashboard.

The TUI works alongside ULPF's existing Elasticsearch/Kibana-based visualization layer.

---

## Features

- Real-time log event monitoring
- Server-Sent Events (SSE) based live updates
- Historical event loading from Elasticsearch through ULPF APIs
- Live exported, quarantined, and dead-letter counters
- Rolling 10-second event throughput
- Log source distribution
- Processing status visualization using donut charts
- ULPF system/runtime information
- Keyboard-based panel navigation
- Expandable panels
- Scrollable expanded views
- In-memory dashboard reset
- Connection status monitoring
- Works entirely inside a terminal
- No browser required

---

## Architecture

The TUI is intentionally implemented as a **presentation layer**.

It does not contain ULPF processing logic.

```text
                    ┌─────────────────────┐
                    │  Python Log          │
                    │  Simulator / Client  │
                    └──────────┬──────────┘
                               │
                               │ POST /api/logs
                               ▼
                    ┌─────────────────────┐
                    │     ULPF Server     │
                    │      Express        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Pipeline        │
                    │                     │
                    │ Parser              │
                    │ Normalizer          │
                    │ Validator           │
                    │ Quarantine          │
                    │ Exporter             │
                    └──────────┬──────────┘
                               │
                         Event Bus
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
             Elasticsearch          SSE Stream
                                      /api/stream
                                         │
                                         ▼
                              ┌────────────────────┐
                              │   Terminal TUI     │
                              │ cli-dashboard/     │
                              │ dashboard.js       │
                              └────────────────────┘