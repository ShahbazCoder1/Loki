# Loki Log Simulator

The **Loki Log Simulator** is the testing, benchmarking, and telemetry generation engine for the Universal Log Pre-processing Framework (ULPF).

It enables developers, security researchers, and system administrators to validate the entire processing pipeline, test parser extraction accuracy, evaluate quarantine clustering, and benchmark throughput without requiring physical enterprise hardware (firewalls, routers, IDSs) or production SIEM feeds.

---

## Purpose and Role

In enterprise security environments, testing ingestion pipelines typically requires complex network taps, syslog forwarders, or physical appliances. The Log Simulator eliminates this friction by providing:

- **Synthetic Dummy Data Generation**: Generates high-fidelity, randomized network and security logs that accurately simulate enterprise perimeter devices.
- **Parser Verification**: Emits logs that match active declarative YAML parsers (Cisco ASA, Fortinet FortiGate, ArcSight CEF) to verify normalization rules and schema compliance.
- **Quarantine and AI Pipeline Testing**: Emits unrecognized and malformed log patterns alongside real host operating system events to trigger structural template fingerprinting, cluster aggregation, and Ollama AI candidate parser synthesis.
- **Throughput Benchmarking**: Generates rapid bursts of traffic to test server responsiveness, event bus throughput, and Elasticsearch indexing performance.
- **Zero Third-Party Dependencies**: Written entirely in standard library Python 3 using `urllib` (no `pip install` required).

---

## Supported Log Types

The simulator blends multiple traffic categories:

1. **Cisco ASA Firewall Logs**:
   - Syslog text format with `%ASA-` message identifiers.
   - Built, teardown, and denied connection events.
   - Randomized internal subnets (`10.0.0.0/8`, `192.168.1.0/24`), public IPs, and standard transport ports.

2. **Fortinet FortiGate Firewall Logs**:
   - Delimited key-value syntax (`devname=FGT`, `logid=`, `type=traffic`, `subtype=forward`).
   - Allowed, blocked, and closed session telemetry with byte counters and durations.

3. **ArcSight Common Event Format (CEF)**:
   - Pipe-delimited headers (`CEF:0|Vendor|Product|Version|SignatureID|Name|Severity|Extension`).
   - Standard security intrusion and firewall events.

4. **Live Host Operating System Telemetry**:
   - Windows: Reads real Windows System Event Logs directly using `wevtutil`.
   - Linux: Reads local host events via `journalctl` or `/var/log/syslog`.
   - Serves as real-world unparsed data that exercises the quarantine and LLM candidate synthesis loop.

5. **Synthetic Unknown / Malformed Logs**:
   - Zero-day and corrupt patterns designed to verify source-resolver rejection and dead-letter isolation.

---

## Command Reference and Usage

Ensure the Loki API server is running before launching the simulator:

```bash
# Server default: http://localhost:3000
npm start
```

### 1. Stream Mode (Continuous Ingestion)

Continuously emits a weighted mix of synthetic vendor logs, unknown payloads, and live host OS logs.

```bash
# Default speed: 1 log per second
python log-simulator/simulator.py

# Custom speed: Send 1 log every 0.2 seconds (higher throughput)
python log-simulator/simulator.py 0.2

# Custom speed: Send 1 log every 2 seconds (slower inspection)
python log-simulator/simulator.py 2.0
```

### 2. Burst Mode (Throughput & Stress Testing)

Sends a specified number of mixed logs as fast as possible to evaluate queue capacity and Elasticsearch write performance.

```bash
# Send 50 logs in a rapid burst
python log-simulator/simulator.py burst 50

# Send 200 logs
python log-simulator/simulator.py burst 200

# Send 1000 logs for high-volume stress testing
python log-simulator/simulator.py burst 1000
```

### 3. Orchestrated Demo Mode

A curated multi-phase walkthrough designed for presentations, evaluations, and hackathons:

```bash
python log-simulator/simulator.py demo
```

Phase sequence in Demo Mode:
- **Phase 1: Cisco ASA Demonstration**: Streams recognized Cisco ASA firewall events.
- **Phase 2: Fortinet FortiGate Demonstration**: Streams recognized Fortinet key-value events.
- **Phase 3: ArcSight CEF Demonstration**: Streams recognized pipe-delimited CEF events.
- **Phase 4: Quarantine Demonstration**: Emits unrecognized syntax to demonstrate quarantine routing.
- **Phase 5: Live Host Log Telemetry**: Streams real system event logs captured from the host machine.
- **Phase 6: Mixed Stream**: Continues with a balanced, weighted live stream across all categories.

---

## Live Exit Telemetry

When the simulator is terminated (via `Ctrl+C` or after completing a burst/demo run), it prints a consolidated performance ledger:

```text
------------------------------------------------------------
Loki Simulator Performance Summary
------------------------------------------------------------
Total Events Sent    : 250
Exported Events      : 195
Quarantined Events   : 45
Dead-Letter Events   : 10
Failed HTTP Requests : 0
Total Elapsed Time   : 52.4s
Average Throughput   : 4.77 events/sec

Vendor Distribution:
  Cisco ASA          : 85
  Fortinet FortiGate : 60
  Generic CEF        : 50
  Live Host Logs     : 35
  Unknown / Custom   : 20
------------------------------------------------------------
```

---

## Configuration

The simulator reads configuration values from the root `.env` file or environment variables:

| Variable | Default Value | Description |
|---|---|---|
| `ULPF_LOG_API_URL` | `http://localhost:3000/api/logs` | Target endpoint for raw log ingestion |
| `ULPF_API_URL` | `http://localhost:3000` | Fallback base URL for the Loki server |

To target a remote Loki deployment, override the variable:

```bash
# Target a remote or containerized Loki server
ULPF_LOG_API_URL="http://192.168.1.50:3000/api/logs" python log-simulator/simulator.py 0.5
```
