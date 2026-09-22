import fs from "fs";
import path from "path";

const API_URL = process.env.ULPF_LOG_API_URL;

const SAMPLE_LOGS = [
  // Valid Cisco ASA Logs
  "%ASA-6-302013: Built inbound TCP connection 12345 for outside:10.0.0.5/1234 to inside:192.168.1.1/443",
  "%ASA-6-302014: Teardown inbound TCP connection 12345 for outside:10.0.0.5/1234 to inside:192.168.1.1/443 duration 0:00:30 bytes 4096",
  "%ASA-4-106023: Deny tcp src outside:10.0.0.100/5555 dst inside:192.168.1.50/22 by access-group \"OUTSIDE_IN\" [0x0, 0x0]",
  "%ASA-6-302015: Built outbound UDP connection 54321 for inside:192.168.1.20/5353 to outside:8.8.8.8/53",
  "%ASA-6-302016: Teardown outbound UDP connection 54321 for inside:192.168.1.20/5353 to outside:8.8.8.8/53 duration 0:00:02 bytes 128",
  "%ASA-4-106015: Deny TCP (no connection) from 203.0.113.88/443 to inside:10.0.0.15/49152 flags RST on interface outside",
  "%ASA-5-106100: access-list OUTSIDE permitted tcp outside:198.51.100.10/3389 to inside:10.0.0.20/3389 hit-cnt 1 first hit [0x12345678, 0x0]",
  "%ASA-2-106001: Inbound TCP connection denied from 198.51.100.99/50000 to 10.0.0.1/23 flags SYN on interface outside",
  "%ASA-6-302013: Built outbound TCP connection 98765 for inside:192.168.1.100/51234 to outside:172.217.16.206/443",
  "%ASA-6-302014: Teardown outbound TCP connection 98765 for inside:192.168.1.100/51234 to outside:172.217.16.206/443 duration 0:02:15 bytes 1048576",

  // Valid Fortinet Logs
  "date=2026-08-25 time=10:00:00 devname=FGT60E logid=0000000013 type=traffic subtype=forward action=accept srcip=10.0.0.5 dstip=192.168.1.1 srcport=12345 dstport=443 proto=6",
  "date=2026-08-25 time=10:01:00 devname=FGT60E logid=0000000014 type=traffic subtype=forward action=deny srcip=10.0.0.100 dstip=192.168.1.50 srcport=5555 dstport=22 proto=6",
  "date=2026-08-25 time=10:02:00 devname=FGT60E logid=0000000015 type=traffic subtype=forward action=close srcip=192.168.1.20 dstip=8.8.8.8 srcport=5353 dstport=53 proto=17",
  "date=2026-08-25 time=10:03:00 devname=FGT60E logid=0000000016 type=traffic subtype=forward action=accept srcip=198.51.100.10 dstip=10.0.0.20 srcport=3389 dstport=3389 proto=6",
  "date=2026-08-25 time=10:04:00 devname=FGT60E logid=0000000017 type=traffic subtype=forward action=deny srcip=198.51.100.99 dstip=10.0.0.1 srcport=50000 dstport=23 proto=6",

  // Valid Generic CEF Logs
  "CEF:0|Palo Alto|Firewall|10.0|100|Connection Allowed|3|src=10.0.0.5 dst=192.168.1.1 dpt=443 spt=12345 act=allow",
  "CEF:0|CheckPoint|SmartDefense|5.0|200|Attack Blocked|8|src=10.0.0.100 dst=192.168.1.50 dpt=22 act=block msg=SSH brute force",
  "CEF:0|Fortinet|FortiGate|6.0|300|Traffic Dropped|5|src=198.51.100.99 dst=10.0.0.1 dpt=23 act=drop",
  "CEF:0|Cisco|Firepower|7.0|400|Permitted Traffic|2|src=192.168.1.20 dst=8.8.8.8 dpt=53 spt=5353 act=permit",

  // Quarantined Logs (Unknown format)
  "Oct 11 14:32:01 unknown-host random_process[1234]: Completely unparseable arbitrary custom system message log line",
  "<190>2026-08-25T10:00:00Z fw01 filterlog[1234]: 5,,,1000000103,em0,match,block,in,4,0x0,,64,12345,0,DF,6,tcp,60,10.0.0.5,192.168.1.1,5555,443,0,S,123456789,,65535,,mss",
  "Aug 25 10:00:00 juniper-srx RT_FLOW: RT_FLOW_SESSION_CREATE: session created 10.0.0.5/1234->192.168.1.1/443 junos-https 6 trust untrust",
  "25-Aug-2026 10:00:05.100 queries: info: client @0x7f8a9c001000 192.168.1.100#51234 (api.example.com): query: api.example.com IN A + (192.168.1.1)",
  "192.168.1.50 - - [25/Aug/2026:10:00:03 +0000] \"GET /api/v1/health HTTP/1.1\" 200 45 \"-\" \"Mozilla/5.0\"",

  // Dead-letter Logs (Matches Cisco ASA parser signature but missing required src_ip field)
  "%ASA-6-302013: Built inbound TCP connection 12345",
  "%ASA-4-106023: Deny connection 9999"
];

async function seedData() {
  console.log(`Sending ${SAMPLE_LOGS.length} sample events to ${API_URL}...`);

  let countExported = 0;
  let countQuarantined = 0;
  let countDeadLetter = 0;
  let countFailed = 0;

  for (let i = 0; i < SAMPLE_LOGS.length; i++) {
    const raw = SAMPLE_LOGS[i];
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.status === "exported") countExported++;
        else if (data.status === "quarantined") countQuarantined++;
        else if (data.status === "dead-letter") countDeadLetter++;
        console.log(`[${i + 1}/${SAMPLE_LOGS.length}] Status: ${data.status} | ID: ${data.event_id || "N/A"}`);
      } else {
        countFailed++;
        console.error(`[${i + 1}/${SAMPLE_LOGS.length}] Request failed:`, data);
      }
    } catch (err) {
      countFailed++;
      console.error(`[${i + 1}/${SAMPLE_LOGS.length}] Error sending log:`, err.message);
    }
  }

  console.log("\n--- Seeding Summary ---");
  console.log(`Exported (ulpf-events):     ${countExported}`);
  console.log(`Quarantined (ulpf-quarantine): ${countQuarantined}`);
  console.log(`Dead-Letter (ulpf-deadletter): ${countDeadLetter}`);
  console.log(`Errors:                    ${countFailed}`);
}

seedData();
