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
  console.log(`║ ${color(title, BOLD + CYAN)}${" ".repeat(Math.max(0, width - title.length - 4))}║`);

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

function printHeader(event) {
  const width = 80;
  const line = "═".repeat(width - 2);

  console.log();
  console.log(`╔${line}╗`);
  console.log(
    `║ ${color("LOKI EVENT TRACE", BOLD + CYAN)}${" ".repeat(
      width - 20
    )}║`
  );
  console.log(`╠${line}╣`);

  const eventId = String(event.event_id);

  console.log(
    `║ Event ID : ${eventId}${" ".repeat(
      Math.max(0, width - eventId.length - 13)
    )}║`
  );

  console.log(
    `║ Status   : ${color(
      event.processing_status || "-",
      GREEN
    )}${" ".repeat(
      Math.max(
        0,
        width -
          String(event.processing_status || "-").length -
          13
      )
    )}║`
  );

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
    {
      name: "Normalized Field",
      width: 28,
    },
    {
      name: "Value",
      width: 22,
    },
    {
      name: "Raw Fragment",
      width: 24,
    },
    {
      name: "Mapping Rule",
      width: 32,
    },
  ];

  const top =
    "┌" +
    columns
      .map((column) => "─".repeat(column.width + 2))
      .join("┬") +
    "┐";

  const middle =
    "├" +
    columns
      .map((column) => "─".repeat(column.width + 2))
      .join("┼") +
    "┤";

  const bottom =
    "└" +
    columns
      .map((column) => "─".repeat(column.width + 2))
      .join("┴") +
    "┘";

  console.log(top);

  console.log(
    "│" +
      columns
        .map(
          (column) =>
            ` ${truncate(column.name, column.width)} `
        )
        .join("│") +
      "│"
  );

  console.log(middle);

  for (const [normalizedField, item] of entries) {
    const value =
      event.normalized?.[normalizedField] ??
      item.raw_fragment ??
      "-";

    const rawFragment =
      item.raw_fragment || "-";

    const mappingRule =
      item.mapping_rule || "-";

    console.log(
      "│" +
        ` ${truncate(normalizedField, columns[0].width)} ` +
        "│" +
        ` ${truncate(value, columns[1].width)} ` +
        "│" +
        ` ${truncate(rawFragment, columns[2].width)} ` +
        "│" +
        ` ${truncate(mappingRule, columns[3].width)} ` +
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