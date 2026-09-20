import crypto from "crypto";
import readline from "readline";

const API_BASE = process.env.ULPF_API_URL || "http://localhost:3000";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

const STAGES = [
  "ingest",
  "resolve",
  "parse",
  "normalize",
  "validate",
  "export",
];

function color(text, colorCode) {
  return `${colorCode}${text}${RESET}`;
}

// Strip ANSI escape codes so we can measure *visible* string length.
// This is the root cause of the overflow bug: color("...", GREEN) adds
// invisible bytes that were being counted against the padding width.
function visibleLength(str) {
  return String(str).replace(/\x1b\[[0-9;]*m/g, "").length;
}

function padVisible(str, width) {
  const pad = Math.max(0, width - visibleLength(str));
  return str + " ".repeat(pad);
}

function truncate(value, width) {
  const str = String(value ?? "-");

  if (str.length <= width) {
    return str.padEnd(width);
  }

  return `${str.slice(0, width - 3)}...`;
}

function printBox(title, content, width = 80) {
  const top = `╔${"═".repeat(width - 2)}╗`;
  const bottom = `╚${"═".repeat(width - 2)}╝`;

  console.log(top);
  console.log(`║ ${padVisible(color(title, BOLD + CYAN), width - 4)} ║`);

  for (const line of content) {
    const text = String(line);
    console.log(`║ ${text.slice(0, width - 4).padEnd(width - 4)} ║`);
  }

  console.log(bottom);
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function selectEventInteractively() {
  console.log(color("\nFetching recent events...\n", CYAN));

  const response = await apiGet("/api/events");

  // Support either a direct array or { events: [...] }
  const events = Array.isArray(response)
    ? response
    : response.events || [];

  if (!events.length) {
    throw new Error("No events found.");
  }

  console.log(
    color(
      " #   Event ID                              Source              Received At",
      BOLD
    )
  );

  console.log("─".repeat(90));

  events.forEach((event, index) => {
    const source =
      event.source?.type ||
      event.source_type ||
      event.source ||
      "-";

    const receivedAt =
      event.received_at ||
      event.receivedAt ||
      "-";

    console.log(
      `${String(index + 1).padStart(2)}   ` +
      `${truncate(event.event_id, 36)}   ` +
      `${truncate(source, 18)}   ` +
      `${receivedAt}`
    );
  });

  console.log();

  const answer = await ask(
    color("Select an event number: ", YELLOW)
  );

  const index = Number(answer) - 1;

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= events.length
  ) {
    throw new Error("Invalid selection.");
  }

  return events[index].event_id;
}

// Header box now sizes itself to the longest visible line instead of
// assuming a fixed 80-col width. This is what makes long event IDs,
// long statuses, etc. render correctly without blowing out the border.
function printHeader(event) {
  const title = "LOKI EVENT TRACE";
  const eventId = String(event.event_id ?? "-");
  const status = String(event.processing_status || "-");

  const rows = [
    { label: "Event ID", value: eventId, valueColor: null },
    { label: "Status", value: status, valueColor: GREEN },
  ];

  // Compute the longest label so labels align (e.g. "Event ID" vs "Status").
  const labelWidth = Math.max(...rows.map((r) => r.label.length));

  const plainLines = [
    title,
    ...rows.map((r) => `${r.label.padEnd(labelWidth)} : ${r.value}`),
  ];

  const innerWidth =
    Math.max(...plainLines.map((line) => line.length)) + 2; // 1 space padding each side
  const width = innerWidth + 2; // + 2 border chars

  const line = "═".repeat(width - 2);

  console.log();
  console.log(`╔${line}╗`);
  console.log(`║ ${padVisible(color(title, BOLD + CYAN), width - 4)} ║`);
  console.log(`╠${line}╣`);

  for (const row of rows) {
    const plain = `${row.label.padEnd(labelWidth)} : ${row.value}`;
    const rendered = row.valueColor
      ? `${row.label.padEnd(labelWidth)} : ${color(row.value, row.valueColor)}`
      : plain;

    console.log(`║ ${padVisible(rendered, width - 4)} ║`);
  }

  console.log(`╚${line}╝`);
  console.log();
}

function printProvenance(event) {
  console.log(color("2. PROVENANCE CHAIN", BOLD + CYAN));
  console.log();

  const provenance = event.provenance || [];

  const stages = STAGES.map((stageName) => {
    return (
      provenance.find(
        (item) =>
          String(item.stage || item.name || "").toLowerCase() ===
          stageName
      ) || null
    );
  });

  const stageParts = stages.map((stage, index) => {
    const name = STAGES[index].toUpperCase();

    let status = "unknown";

    if (stage) {
      status = String(stage.status || "").toLowerCase();
    }

    let stageColor = YELLOW;

    if (status === "success") {
      stageColor = GREEN;
    } else if (status === "failure") {
      stageColor = RED;
    }

    const symbol = color("●", stageColor);
    const label = color(name, stageColor);

    return {
      text: `${symbol} ${label}`,
      stage,
    };
  });

  console.log(
    stageParts.map((part) => part.text).join(" ──→ ")
  );

  console.log();

  const timestamps = stages.map((stage) => {
    if (!stage) return "-";

    const timestamp =
      stage.timestamp ||
      stage.processed_at ||
      stage.time;

    if (!timestamp) return "-";

    return new Date(timestamp).toLocaleTimeString();
  });

  console.log(
    timestamps
      .map((time) => color(time, DIM))
      .join("      ")
  );

  console.log();
}

function printRawLog(event) {
  console.log(color("3. RAW LOG", BOLD + CYAN));
  console.log();

  const rawLog =
    event.raw?.immutable_payload ??
    event.raw?.payload ??
    "";

  const width = 90;

  console.log(`┌${"─".repeat(width - 2)}┐`);

  const lines = String(rawLog).split("\n");

  for (const line of lines) {
    console.log(`│ ${line.slice(0, width - 4).padEnd(width - 4)} │`);
  }

  console.log(`└${"─".repeat(width - 2)}┘`);

  const storedHash =
    event.raw?.integrity_hash || "";

  const storedHashWithoutPrefix = storedHash
    .replace(/^sha256:/i, "")
    .trim();

  const calculatedHash = crypto
    .createHash("sha256")
    .update(String(rawLog))
    .digest("hex");

  const hashMatches =
    calculatedHash === storedHashWithoutPrefix;

  console.log();
  console.log(`Stored hash     : ${storedHash || "-"}`);
  console.log(`Calculated hash : sha256:${calculatedHash}`);

  if (hashMatches) {
    console.log(
      color("✓ SHA-256 integrity verified", GREEN)
    );
  } else {
    console.log(
      color("✗ SHA-256 integrity verification FAILED", RED)
    );
  }

  console.log();
}

// Field lineage table now computes each column's width from its own
// longest cell (with sane min/max bounds) instead of using fixed widths.
// This fixes "extensions.vendor_fortine..." truncation for both the
// column header and every row that shares that column.
function printFieldLineage(event) {
  console.log(color("4. FIELD LINEAGE", BOLD + CYAN));
  console.log();

  const lineage = event.field_lineage || {};

  const entries = Object.entries(lineage);

  if (!entries.length) {
    console.log(color("No field lineage available.", YELLOW));
    console.log();
    return;
  }

  const columns = [
    { key: "field", name: "Normalized Field", min: 16, max: 40 },
    { key: "value", name: "Value", min: 10, max: 40 },
    { key: "raw", name: "Raw Fragment", min: 12, max: 40 },
    { key: "rule", name: "Mapping Rule", min: 12, max: 48 },
  ];

  const rows = entries.map(([normalizedField, item]) => {
    const value =
      event.normalized?.[normalizedField] ?? item.raw_fragment ?? "-";
    const rawFragment = item.raw_fragment || "-";
    const mappingRule = item.mapping_rule || "-";

    return {
      field: normalizedField,
      value: String(value),
      raw: String(rawFragment),
      rule: String(mappingRule),
    };
  });

  // Compute each column's width from header + all cell contents,
  // clamped to [min, max] so one giant value can't blow out the terminal.
  for (const column of columns) {
    const longest = Math.max(
      column.name.length,
      ...rows.map((row) => row[column.key].length)
    );
    column.width = Math.min(column.max, Math.max(column.min, longest));
  }

  const top =
    "┌" +
    columns.map((column) => "─".repeat(column.width + 2)).join("┬") +
    "┐";

  const middle =
    "├" +
    columns.map((column) => "─".repeat(column.width + 2)).join("┼") +
    "┤";

  const bottom =
    "└" +
    columns.map((column) => "─".repeat(column.width + 2)).join("┴") +
    "┘";

  console.log(top);

  console.log(
    "│" +
      columns
        .map((column) => ` ${truncate(column.name, column.width)} `)
        .join("│") +
      "│"
  );

  console.log(middle);

  for (const row of rows) {
    console.log(
      "│" +
        columns
          .map((column) => ` ${truncate(row[column.key], column.width)} `)
          .join("│") +
        "│"
    );
  }

  console.log(bottom);
  console.log();
}

function printSourceResolution(event) {
  console.log(color("5. SOURCE RESOLUTION", BOLD + CYAN));
  console.log();

  const source = event.source || {};
  const parsed = event.parsed || {};

  const parserId =
    parsed.parser_id ||
    parsed.parserId ||
    "-";

  const confidence =
    source.resolution_confidence ??
    source.confidence ??
    "-";

  const method =
    source.resolution_method ||
    source.resolutionMethod ||
    "-";

  console.log(
    `Parser ID: ${color(parserId, GREEN)}   ` +
    `Confidence: ${color(String(confidence), GREEN)}   ` +
    `Method: ${color(method, CYAN)}`
  );

  console.log();
}

async function traceEvent(eventId) {
  console.log(
    color(`\nFetching event ${eventId}...\n`, CYAN)
  );

  const event = await apiGet(
    `/api/events/${encodeURIComponent(eventId)}/full`
  );

  printHeader(event);
  printProvenance(event);
  printRawLog(event);
  printFieldLineage(event);
  printSourceResolution(event);
}

async function main() {
  try {
    const argument = process.argv[2];

    if (!argument) {
      console.log(`
Usage:

  node cli-dashboard/trace.js <event_id>
  node cli-dashboard/trace.js --list
`);
      process.exitCode = 1;
      return;
    }

    let eventId = argument;

    if (argument === "--list") {
      eventId = await selectEventInteractively();
    }

    await traceEvent(eventId);
  } catch (error) {
    console.error(
      color(`\n✗ ${error.message}\n`, RED)
    );

    process.exitCode = 1;
  }
}

main();