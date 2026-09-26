#!/usr/bin/env python3
"""
Loki Log Simulator (Universal Log Pre-processing Framework)
-----------------------------------------------------------
Simulates network perimeter devices, SIEM feeds, and real host system logs
by sending synthetic and live logs to the Loki API server.

Modes:
  - Stream Mode: Continuous stream of mixed synthetic + real laptop logs.
      python simulator.py [interval_seconds]
  - Burst Mode: Sends N mixed logs as fast as possible.
      python simulator.py burst [count]
  - Demo Mode: Orchestrated multi-phase showcase for presentations/hackathons.
      python simulator.py demo
"""

import sys
import os
import json
import time
import random
import platform
import subprocess
import datetime
import urllib.request
import urllib.error

# Load .env manually since python-dotenv is not guaranteed to be installed
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                key, val = line.strip().split("=", 1)
                os.environ.setdefault(key, val)

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
API_URL = os.environ.get("ULPF_LOG_API_URL")
# Terminal Color Codes
class Colors:
    HEADER = "\033[95m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    UNDERLINE = "\033[4m"
    END = "\033[0m"

# Statistics tracker
STATS = {
    "total": 0,
    "exported": 0,
    "quarantined": 0,
    "dead_letter": 0,
    "errors": 0,
    "real_laptop": 0,
    "cisco": 0,
    "fortinet": 0,
    "cef": 0,
    "unknown": 0,
    "start_time": time.time()
}

# Subnets & IP Pools for realistic randomization
INTERNAL_IPS = [
    f"10.0.0.{i}" for i in range(2, 250)
] + [
    f"192.168.1.{i}" for i in range(10, 200)
] + [
    f"172.16.0.{i}" for i in range(5, 100)
]

EXTERNAL_IPS = [
    f"198.51.100.{i}" for i in range(2, 250)
] + [
    f"203.0.113.{i}" for i in range(2, 250)
] + [
    f"142.250.190.{i}" for i in range(10, 100)
] + [
    "8.8.8.8", "8.8.4.4", "1.1.1.1", "9.9.9.9"
]

COMMON_PORTS = [22, 53, 80, 443, 8080, 3389, 21, 25, 123, 161, 445, 1433]

# -----------------------------------------------------------------------------
# Real Laptop Log Capture (Windows / Linux)
# -----------------------------------------------------------------------------
REAL_LOGS_CACHE = []
LAST_CACHE_UPDATE = 0

def capture_real_host_logs(count=20):
    """Capture real system event logs from current host OS."""
    os_type = platform.system()
    logs = []

    if os_type == "Windows":
        try:
            # Query Windows System & Application logs using wevtutil
            cmd = ["wevtutil", "qe", "System", f"/c:{count}", "/rd:true", "/f:text"]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if result.returncode == 0 and result.stdout:
                raw_events = result.stdout.strip().split("Event[")
                for ev in raw_events:
                    if not ev.strip():
                        continue
                    lines = [line.strip() for line in ev.splitlines() if line.strip()]
                    source = "Unknown"
                    event_id = "0"
                    level = "Info"
                    computer = platform.node()
                    desc = ""
                    for line in lines:
                        if line.startswith("Source:"):
                            source = line.split("Source:", 1)[1].strip()
                        elif line.startswith("Event ID:"):
                            event_id = line.split("Event ID:", 1)[1].strip()
                        elif line.startswith("Level:"):
                            level = line.split("Level:", 1)[1].strip()
                        elif line.startswith("Computer:"):
                            computer = line.split("Computer:", 1)[1].strip()
                        elif line.startswith("Description:"):
                            desc = line.split("Description:", 1)[1].strip()

                    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
                    formatted = f"{now_str} {computer} MSWinEventLog: Source={source} EventID={event_id} Level={level} Msg={desc or 'System event recorded'}"
                    logs.append(formatted)
        except Exception as e:
            pass

    elif os_type == "Linux":
        try:
            # Read from /var/log/syslog or journalctl
            cmd = ["journalctl", "-n", str(count), "--no-pager", "-o", "short-iso"]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            if result.returncode == 0 and result.stdout:
                for line in result.stdout.splitlines():
                    if line.strip():
                        logs.append(line.strip())
        except Exception:
            pass

    # Fallback if host log capture yielded nothing
    if not logs:
        node = platform.node() or "host"
        logs = [
            f"HostLog: System={os_type} Host={node} KernelStatus=OK ActiveConnections=18 CPU_Load=12%",
            f"HostSecurity: Host={node} User={os.environ.get('USERNAME', 'user')} AuthCheck=Passed SessionActive=true"
        ]

    return logs

def get_real_laptop_log():
    """Retrieve a real log from the host system cache."""
    global REAL_LOGS_CACHE, LAST_CACHE_UPDATE
    now = time.time()
    if not REAL_LOGS_CACHE or (now - LAST_CACHE_UPDATE) > 60:
        REAL_LOGS_CACHE = capture_real_host_logs(20)
        LAST_CACHE_UPDATE = now

    if REAL_LOGS_CACHE:
        return random.choice(REAL_LOGS_CACHE)
    return f"HostLog: OS={platform.system()} Hostname={platform.node()} Uptime={int(time.time())}"

# -----------------------------------------------------------------------------
# Dynamic Synthetic Log Generators
# -----------------------------------------------------------------------------
def random_cisco_asa():
    """Generate dynamic Cisco ASA firewall log."""
    src_ip = random.choice(EXTERNAL_IPS)
    dst_ip = random.choice(INTERNAL_IPS)
    src_port = random.randint(1024, 65535)
    dst_port = random.choice(COMMON_PORTS)
    conn_id = random.randint(10000, 99999)
    duration = f"0:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}"
    bytes_count = random.choice([64, 128, 512, 1024, 4096, 65536, 1048576])

    templates = [
        f"%ASA-6-302013: Built inbound TCP connection {conn_id} for outside:{src_ip}/{src_port} to inside:{dst_ip}/{dst_port}",
        f"%ASA-6-302014: Teardown inbound TCP connection {conn_id} for outside:{src_ip}/{src_port} to inside:{dst_ip}/{dst_port} duration {duration} bytes {bytes_count}",
        f"%ASA-4-106023: Deny tcp src outside:{src_ip}/{src_port} dst inside:{dst_ip}/{dst_port} by access-group \"OUTSIDE_IN\" [0x0, 0x0]",
        f"%ASA-6-302015: Built outbound UDP connection {conn_id} for inside:{src_ip}/{src_port} to outside:{dst_ip}/{dst_port}",
        f"%ASA-6-302016: Teardown outbound UDP connection {conn_id} for inside:{src_ip}/{src_port} to outside:{dst_ip}/{dst_port} duration {duration} bytes {bytes_count}",
        f"%ASA-5-106100: access-list OUTSIDE permitted tcp from outside:{src_ip}/{src_port} to inside:{dst_ip}/{dst_port} hit-cnt 1 first hit [0x12345678, 0x0]",
        f"%ASA-2-106001: Inbound TCP connection denied from {src_ip}/{src_port} to {dst_ip}/{dst_port} flags SYN on interface outside",
        f"%ASA-3-710003: TCP access denied by ACL from {src_ip}/{src_port} to outside:{dst_ip}/{dst_port}",
        f"%ASA-4-106015: Deny TCP (no connection) from {src_ip}/{src_port} to inside:{dst_ip}/{dst_port} flags RST on interface outside"
    ]
    return random.choice(templates)

def random_fortinet():
    """Generate dynamic Fortinet FortiGate key-value log."""
    now = datetime.datetime.now(datetime.timezone.utc)
    date_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%H:%M:%S")
    devname = random.choice(["FGT60E", "FGT100D", "FGT200E", "FGT300E", "FGT500E"])
    action = random.choice(["accept", "deny", "close", "drop", "block"])
    src_ip = random.choice(EXTERNAL_IPS if action in ["deny", "drop", "block"] else INTERNAL_IPS)
    dst_ip = random.choice(INTERNAL_IPS if action in ["deny", "drop", "block"] else EXTERNAL_IPS)
    src_port = random.randint(1024, 65535)
    dst_port = random.choice(COMMON_PORTS)
    proto = random.choice([6, 17])
    sent_byte = random.randint(64, 4096)
    rcvd_byte = random.randint(64, 16384)
    duration = random.randint(1, 300)

    log = f"date={date_str} time={time_str} devname={devname} logid=0000000013 type=traffic subtype=forward action={action} srcip={src_ip} dstip={dst_ip} srcport={src_port} dstport={dst_port} proto={proto} duration={duration} sentbyte={sent_byte} rcvdbyte={rcvd_byte}"
    if action in ["deny", "drop", "block"]:
        log += f" level=alert msg=\"Security policy rule violation blocked\""
    return log

def random_cef():
    """Generate dynamic ArcSight CEF format log."""
    vendor = random.choice(["Palo Alto", "CheckPoint", "Imperva", "F5", "Trend Micro", "Fortinet", "Cisco"])
    product = random.choice(["Firewall", "SmartDefense", "SecureSphere", "BIG-IP", "Deep Security", "Firepower"])
    version = random.choice(["10.0", "5.0", "14.0", "15.1", "20.0"])
    sig_id = random.choice(["100", "200", "1000", "4000000", "THREAT", "430001"])
    action = random.choice(["allow", "block", "deny", "drop", "log", "reset"])
    severity = random.choice([2, 3, 5, 7, 8, 9])
    src_ip = random.choice(EXTERNAL_IPS)
    dst_ip = random.choice(INTERNAL_IPS)
    src_port = random.randint(1024, 65535)
    dst_port = random.choice(COMMON_PORTS)
    proto = random.choice(["tcp", "udp"])

    return f"CEF:0|{vendor}|{product}|{version}|{sig_id}|Connection Traffic Event|{severity}|src={src_ip} dst={dst_ip} spt={src_port} dpt={dst_port} act={action} proto={proto} msg=Automated traffic monitor event"

def random_unknown():
    """Generate unknown format log (quarantine candidate)."""
    src_ip = random.choice(EXTERNAL_IPS)
    dst_ip = random.choice(INTERNAL_IPS)
    src_port = random.randint(1024, 65535)
    dst_port = random.choice(COMMON_PORTS)
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")

    templates = [
        f"<190>{now_iso} fw01 filterlog[1234]: 5,,,1000000103,em0,match,block,in,4,0x0,,64,12345,0,DF,6,tcp,60,{src_ip},{dst_ip},{src_port},{dst_port},0,S,123456789,,65535,,mss",
        f"Aug 25 10:00:00 juniper-srx RT_FLOW: RT_FLOW_SESSION_CREATE: session created {src_ip}/{src_port}->{dst_ip}/{dst_port} junos-https 6 trust untrust",
        f"25-Aug-2026 10:00:05.100 queries: info: client @0x7f8a9c001000 {src_ip}#{src_port} (api.example.com): query: api.example.com IN A + ({dst_ip})",
        f"{src_ip} - - [25/Aug/2026:10:00:03 +0000] \"GET /api/v1/telemetry HTTP/1.1\" 200 145 \"-\" \"Mozilla/5.0 (Security Scanner)\"",
        f"Oct 11 14:32:01 unknown-gateway security_daemon[9876]: Custom router security event payload src={src_ip}:{src_port} dst={dst_ip}:{dst_port} status=intercepted"
    ]
    return random.choice(templates)

def random_deadletter():
    """Generate log with known signature but invalid structure to trigger dead-letter."""
    templates = [
        # Matches Cisco ASA signature but missing required action/IP fields
        f"%ASA-6-999999: System error occurred during processing [MALFORMED DEADLETTER LOG]",
        # Matches Fortinet signature but completely broken key-value pairs
        f"date=2026-08-25 devname=FGT100D CRASH_DUMP: {random.randint(1000, 9999)} invalid_state [MALFORMED DEADLETTER LOG]",
        # Matches CEF signature but missing severity and other mandatory fields
        f"CEF:0|Vendor|Product|1.0|100|Error||msg=Completely broken CEF payload [MALFORMED DEADLETTER LOG]"
    ]
    return random.choice(templates)

# -----------------------------------------------------------------------------
# Weighted Mixer: Synthetic + Real Host Logs
# -----------------------------------------------------------------------------
def pick_random_mixed_log():
    """
    Weighted log picker:
      - 20% Cisco ASA (synthetic)
      - 20% Fortinet (synthetic)
      - 20% CEF (synthetic)
      - 10% Unknown format (synthetic)
      - 10% Malformed Dead-Letter
      - 20% Real Laptop OS Event Logs (live host capture)
    """
    roll = random.random()
    if roll < 0.20:
        return random_cisco_asa(), "Cisco ASA", "cisco"
    elif roll < 0.40:
        return random_fortinet(), "Fortinet", "fortinet"
    elif roll < 0.60:
        return random_cef(), "CEF", "cef"
    elif roll < 0.70:
        return random_unknown(), "Unknown Format", "unknown"
    elif roll < 0.80:
        return random_deadletter(), "Malformed (Dead-Letter)", "dead_letter"
    else:
        return get_real_laptop_log(), f"Real Laptop ({platform.system()})", "real_laptop"

# -----------------------------------------------------------------------------
# Core HTTP Sender
# -----------------------------------------------------------------------------
def send_log(raw_log, source_label, category_key=None):
    """Post log payload to Loki API and print formatted status."""
    payload = json.dumps({"raw": raw_log}).encode("utf-8")
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "ULPF-Simulator/1.0"}
    )

    STATS["total"] += 1
    if category_key and category_key in STATS:
        STATS[category_key] += 1

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            res_body = response.read().decode("utf-8")
            data = json.loads(res_body)
            status = data.get("status", "unknown")
            event_id = data.get("event_id", "N/A")

            if status == "exported":
                STATS["exported"] += 1
                color = Colors.GREEN
                tag = "[EXPORTED]"
            elif status == "quarantined":
                STATS["quarantined"] += 1
                color = Colors.YELLOW
                tag = "[QUARANTINED]"
            elif status == "dead-letter":
                STATS["dead_letter"] += 1
                color = Colors.RED
                tag = "[DEAD-LETTER]"
            else:
                color = Colors.CYAN
                tag = f"[{status.upper()}]"

            print(f"{color}{tag:<15}{Colors.END} {Colors.BOLD}{source_label:<24}{Colors.END} | ID: {event_id[:16]}... | Payload: {raw_log[:60]}...")
            return data

    except urllib.error.HTTPError as e:
        STATS["errors"] += 1
        print(f"{Colors.RED}[HTTP ERROR {e.code}]{Colors.END} {source_label}: {e.reason}")
    except urllib.error.URLError as e:
        STATS["errors"] += 1
        print(f"{Colors.RED}[CONN ERROR]{Colors.END} Could not reach Loki server at {API_URL}: {e.reason}")
    except Exception as e:
        STATS["errors"] += 1
        print(f"{Colors.RED}[ERROR]{Colors.END} {source_label}: {str(e)}")
    return None

# -----------------------------------------------------------------------------
# Presentation Summary Banner
# -----------------------------------------------------------------------------
def print_summary():
    """Print clean summary statistics."""
    elapsed = time.time() - STATS["start_time"]
    rate = STATS["total"] / max(elapsed, 0.001)

    print("\n" + "=" * 65)
    print(f"{Colors.BOLD}{Colors.CYAN}            Loki LOG SIMULATION SUMMARY REPORT{Colors.END}")
    print("=" * 65)
    print(f" Total Events Sent:      {Colors.BOLD}{STATS['total']}{Colors.END}")
    print(f" Runtime Elapsed:        {elapsed:.2f} seconds ({rate:.1f} events/sec)")
    print("-" * 65)
    print(f" {Colors.GREEN}✔ Exported (Parsed OCSF):  {STATS['exported']:<6}{Colors.END} (ulpf-events index)")
    print(f" {Colors.YELLOW}⚠ Quarantined (Unknown):   {STATS['quarantined']:<6}{Colors.END} (ulpf-quarantine index)")
    print(f" {Colors.RED}✖ Dead-Letter (Invalid):   {STATS['dead_letter']:<6}{Colors.END} (ulpf-deadletter index)")
    print(f"   Errors / Failures:      {STATS['errors']}")
    print("-" * 65)
    print(f" Source Breakdown:")
    print(f"   - Cisco ASA:            {STATS['cisco']}")
    print(f"   - Fortinet:             {STATS['fortinet']}")
    print(f"   - ArcSight CEF:         {STATS['cef']}")
    print(f"   - Synthetic Unknown:    {STATS['unknown']}")
    print(f"   - {Colors.CYAN}Live Laptop Host Logs: {STATS['real_laptop']}{Colors.END} ({platform.system()})")
    print("=" * 65 + "\n")

# -----------------------------------------------------------------------------
# Modes of Operation
# -----------------------------------------------------------------------------
def run_stream(delay=1.0):
    """Continuous stream of mixed logs."""
    print(f"{Colors.HEADER}======================================================={Colors.END}")
    print(f"{Colors.BOLD}Loki Log Simulator — Stream Mode{Colors.END}")
    print(f"Streaming mixed synthetic + real laptop logs every {delay}s...")
    print(f"Target Server: {API_URL}")
    print(f"Press {Colors.BOLD}Ctrl + C{Colors.END} at any time to stop and view report.")
    print(f"{Colors.HEADER}======================================================={Colors.END}\n")

    try:
        while True:
            raw_log, label, cat = pick_random_mixed_log()
            send_log(raw_log, label, cat)
            time.sleep(delay)
    except KeyboardInterrupt:
        print_summary()

def run_burst(count=50):
    """Fast burst of N mixed logs."""
    print(f"{Colors.HEADER}======================================================={Colors.END}")
    print(f"{Colors.BOLD}Loki Log Simulator — Burst Mode{Colors.END}")
    print(f"Sending {count} mixed logs in fast burst...")
    print(f"Target Server: {API_URL}")
    print(f"{Colors.HEADER}======================================================={Colors.END}\n")

    for i in range(count):
        raw_log, label, cat = pick_random_mixed_log()
        send_log(raw_log, label, cat)
        time.sleep(0.02)  # Tiny yield to prevent socket exhaustion

    print_summary()

def run_demo():
    """Orchestrated hackathon demo presentation sequence."""
    print(f"{Colors.HEADER}================================================================={Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}       Loki HACKATHON LIVE DEMO SIMULATION ENGINE{Colors.END}")
    print(f" Demonstrating confidence resolution, multi-vendor parsing,")
    print(f" live laptop log quarantine, and real-time Kibana analytics.")
    print(f"{Colors.HEADER}================================================================={Colors.END}\n")

    phases = [
        ("Phase 1: Cisco ASA Perimeter Firewall", [random_cisco_asa() for _ in range(5)], "Cisco ASA", "cisco", 1.0),
        ("Phase 2: Fortinet FortiGate Gateway", [random_fortinet() for _ in range(5)], "Fortinet", "fortinet", 1.0),
        ("Phase 3: ArcSight Common Event Format (CEF)", [random_cef() for _ in range(5)], "CEF", "cef", 1.0),
        ("Phase 4: Unrecognized Device Logs (Quarantine Trigger)", [random_unknown() for _ in range(4)], "Unknown Format", "unknown", 1.2),
        (f"Phase 5: LIVE Laptop System Logs ({platform.system()})", [get_real_laptop_log() for _ in range(5)], f"Real Laptop ({platform.system()})", "real_laptop", 1.2),
        ("Phase 6: Malformed Logs (Dead-Letter Trigger)", [random_deadletter() for _ in range(3)], "Malformed (Dead-Letter)", "dead_letter", 1.2)
    ]

    try:
        for phase_title, logs, label, cat, phase_delay in phases:
            print(f"\n{Colors.BOLD}{Colors.BLUE}▶ {phase_title}{Colors.END}")
            print("-" * 55)
            for log in logs:
                send_log(log, label, cat)
                time.sleep(phase_delay)
            time.sleep(1.0)

        print(f"\n{Colors.BOLD}{Colors.GREEN}▶ Phase 7: Continuous Mixed Ingestion Stream (Synthetic + Real){Colors.END}")
        print("Kibana dashboard is now receiving live multi-vendor telemetry...")
        print(f"Press {Colors.BOLD}Ctrl + C{Colors.END} to finish demo.\n")
        print("-" * 55)

        while True:
            raw_log, label, cat = pick_random_mixed_log()
            send_log(raw_log, label, cat)
            time.sleep(0.8)

    except KeyboardInterrupt:
        print_summary()

# -----------------------------------------------------------------------------
# Main Entry Point
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    args = sys.argv[1:]

    if not args:
        run_stream(1.0)
    elif args[0].lower() == "demo":
        run_demo()
    elif args[0].lower() == "burst":
        count = int(args[1]) if len(args) > 1 and args[1].isdigit() else 50
        run_burst(count)
    else:
        try:
            delay = float(args[0])
            run_stream(delay)
        except ValueError:
            print(f"Usage:")
            print(f"  python simulator.py            (Stream 1 log/sec)")
            print(f"  python simulator.py <interval> (Stream every N seconds, e.g. 0.5)")
            print(f"  python simulator.py burst <N>  (Send N logs in rapid burst)")
            print(f"  python simulator.py demo       (Run orchestrated hackathon demo)")
