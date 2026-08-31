# ULPF Python Log Simulator

The **ULPF Log Simulator** acts as a live telemetry engine that sends realistic firewall/proxy logs and real host OS event logs into the Universal Log Pre-processing Framework (ULPF) API server (`http://localhost:3000/api/logs`).

---

## Features

- **Zero Third-Party Dependencies**: Runs directly on pure Python 3 using `urllib` (no `pip install` required).
- **Multi-Vendor Synthetic Generation**: Dynamically creates randomized Cisco ASA, Fortinet FortiGate, and ArcSight CEF logs with randomized IP subnets, ports, and action labels.
- **Live Laptop Host Log Capture**: Dynamically captures real OS events (Windows System Event Logs via `wevtutil` on Windows, or Syslog/Journalctl on Linux) and sends them to trigger real-world Quarantine telemetry.
- **Weighted Mixed Stream**: Blends 70% recognized vendor logs with 10% synthetic unknown and 20% live laptop logs.
- **Orchestrated Hackathon Demo Mode**: Sequentially showcases Cisco $\rightarrow$ Fortinet $\rightarrow$ CEF $\rightarrow$ Unknown Quarantine $\rightarrow$ Live Laptop Logs $\rightarrow$ Continuous live flood.
- **Live Statistics**: Computes real-time throughput, status breakdown (`exported`, `quarantined`, `dead-letter`), and vendor distribution upon exit.

---

## Quick Start

Make sure the ULPF server is running:
```bash
node server.js
```

### 1. Stream Mode (Default: 1 log / sec)
```bash
python log-simulator/simulator.py
```
To adjust the speed (e.g. 1 log every 0.3 seconds):
```bash
python log-simulator/simulator.py 0.3
```

### 2. Burst Mode (Send N logs instantly)
```bash
# Send 50 logs in a rapid burst
python log-simulator/simulator.py burst 50

# Send 200 logs
python log-simulator/simulator.py burst 200
```

### 3. Hackathon Live Demo Mode
```bash
python log-simulator/simulator.py demo
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ULPF_API_URL` | `http://127.0.0.1:3000/api/logs` | Target ULPF log ingestion endpoint |
