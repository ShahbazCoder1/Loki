import readline from "readline";

const API_BASE = process.env.ULPF_API_URL || "http://localhost:3000";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";

function color(text, code) {
  return `${code}${text}${RESET}`;
}

function truncate(value, width) {
  const text = String(value ?? "-");

  if (text.length <= width) {
    return text.padEnd(width);
  }

  return `${text.slice(0, width - 3)}...`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error ||
      data?.details ||
      `${response.status} ${response.statusText}`;

    throw new Error(`${response.status} ${message}`);
  }

  return data;
}

async function getCandidates() {
  const data = await apiRequest("/api/intelligence/candidates");

  return data?.candidates || [];
}

function printCandidateTable(candidates) {
  console.log();
  console.log(color("CANDIDATE PARSER APPROVAL", BOLD + CYAN));
  console.log();

  const columns = [
    ["#", 4],
    ["Candidate ID", 30],
    ["Device Family", 20],
    ["Cluster", 8],
    ["Tests", 10],
    ["Status", 12],
  ];

  const border =
    "─".repeat(4 + 2) +
    "┼" +
    "─".repeat(30 + 2) +
    "┼" +
    "─".repeat(20 + 2) +
    "┼" +
    "─".repeat(8 + 2) +
    "┼" +
    "─".repeat(10 + 2) +
    "┼" +
    "─".repeat(12 + 2);

  console.log(`┌${border}┐`);

  console.log(
    `│ ${truncate("#", 4)} │ ` +
      `${truncate("Candidate ID", 30)} │ ` +
      `${truncate("Device Family", 20)} │ ` +
      `${truncate("Cluster", 8)} │ ` +
      `${truncate("Tests", 10)} │ ` +
      `${truncate("Status", 12)} │`
  );

  console.log(`├${border}┤`);

  candidates.forEach((candidate, index) => {
    const positive = candidate.test_results?.positive;
    const tests = positive
      ? `${positive.passed}/${positive.total}`
      : "-";

    console.log(
      `│ ${truncate(index + 1, 4)} │ ` +
        `${truncate(candidate.candidate_id, 30)} │ ` +
        `${truncate(candidate.device_family, 20)} │ ` +
        `${truncate(candidate.cluster_size, 8)} │ ` +
        `${truncate(tests, 10)} │ ` +
        `${truncate(candidate.status, 12)} │`
    );
  });

  console.log(`└${border}┘`);
}

function printCandidateDetails(candidate) {
  const parser = candidate.candidate || {};
  const detection = parser.detection || {};
  const tests = candidate.test_results || {};
  const positive = tests.positive || {};
  const negative = tests.negative || {};

  console.log();
  console.log(color("╔══════════════════════════════════════════════════════════════╗", CYAN));
  console.log(
    color("║              LOKI PARSER CANDIDATE                         ║", BOLD + CYAN)
  );
  console.log(color("╠══════════════════════════════════════════════════════════════╣", CYAN));

  console.log(
    `║ Candidate ID : ${candidate.candidate_id}`
  );
  console.log(
    `║ Parser ID    : ${parser.parser_id || "-"}`
  );
  console.log(
    `║ Version      : ${parser.version || "-"}`
  );
  console.log(
    `║ Device Family: ${parser.device_family || "-"}`
  );
  console.log(
    `║ Cluster Size : ${candidate.cluster_size ?? "-"}`
  );
  console.log(
    `║ Status       : ${candidate.status || "-"}`
  );
  console.log(
    `║ Generated    : ${parser.is_generated ? "YES" : "NO"}`
  );
  console.log(
    `║ Source       : ${parser.source || "-"}`
  );

  console.log(color("╚══════════════════════════════════════════════════════════════╝", CYAN));

  console.log();
  console.log(color("1. DETECTION", BOLD + CYAN));
  console.log(`Structure : ${detection.structure || "-"}`);
  console.log(
    `Keywords  : ${(detection.keywords || []).join(", ") || "-"}`
  );

  if (detection.signatures?.length) {
    console.log("Signatures:");

    for (const signature of detection.signatures) {
      console.log(`  • ${signature}`);
    }
  }

  console.log();
  console.log(color("2. EXTRACTION RULES", BOLD + CYAN));

  if (parser.extraction_rules?.length) {
    for (const rule of parser.extraction_rules) {
      console.log(`  ${rule.field}: ${rule.regex}`);
    }
  } else {
    console.log("  None");
  }

  console.log();
  console.log(color("3. REQUIRED FIELDS", BOLD + CYAN));
  console.log(
    `  ${(parser.required_fields || []).join(", ") || "None"}`
  );

  console.log();
  console.log(color("4. NORMALIZATION MAPPING", BOLD + CYAN));

  const mappings = parser.normalization_mapping || {};

  if (Object.keys(mappings).length) {
    for (const [from, to] of Object.entries(mappings)) {
      console.log(`  ${from} → ${to}`);
    }
  } else {
    console.log("  None");
  }

  console.log();
  console.log(color("5. TEST RESULTS", BOLD + CYAN));

  console.log(
    `  Positive: ${positive.passed ?? 0}/${positive.total ?? 0} passed`
  );

  console.log(
    `  Negative: ${negative.correctly_rejected ?? 0}/${negative.total ?? 0} rejected`
  );

  const overallPass = tests.overall_pass;

  console.log(
    `  Overall : ${
      overallPass
        ? color("PASS", GREEN)
        : color("FAIL", RED)
    }`
  );

  console.log();
}

async function approveCandidate(candidateId) {
  console.log(
    `\nApproving candidate ${color(candidateId, CYAN)}...\n`
  );

  const result = await apiRequest("/api/intelligence/approve", {
    method: "POST",
    body: JSON.stringify({
      candidate_id: candidateId,
    }),
  });

  console.log(
    color("✓ Candidate approved successfully.", GREEN)
  );

  if (result?.message) {
    console.log(result.message);
  }

  console.log();
}

async function rejectCandidate(candidateId) {
  console.log(
    `\nRejecting candidate ${color(candidateId, CYAN)}...\n`
  );

  const result = await apiRequest("/api/intelligence/reject", {
    method: "POST",
    body: JSON.stringify({
      candidate_id: candidateId,
    }),
  });

  console.log(
    color("✓ Candidate rejected successfully.", YELLOW)
  );

  if (result?.message) {
    console.log(result.message);
  }

  console.log();
}

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function interactiveMode() {
  const candidates = await getCandidates();

  if (!candidates.length) {
    console.log(color("\nNo pending candidates found.\n", YELLOW));
    return;
  }

  printCandidateTable(candidates);

  const rl = createReadline();

  try {
    const answer = await ask(
      rl,
      "\nSelect a candidate number: "
    );

    const index = Number.parseInt(answer.trim(), 10) - 1;

    if (
      Number.isNaN(index) ||
      index < 0 ||
      index >= candidates.length
    ) {
      console.log(color("\nInvalid candidate selection.\n", RED));
      return;
    }

    const candidate = candidates[index];

    printCandidateDetails(candidate);

    while (true) {
      const action = (
        await ask(
          rl,
          "[A]pprove / [R]eject / [B]ack: "
        )
      )
        .trim()
        .toLowerCase();

      if (action === "a" || action === "approve") {
        await approveCandidate(candidate.candidate_id);
        break;
      }

      if (action === "r" || action === "reject") {
        await rejectCandidate(candidate.candidate_id);
        break;
      }

      if (action === "b" || action === "back") {
        console.log("\nReturning...\n");
        break;
      }

      console.log(
        color("Please enter A, R, or B.", YELLOW)
      );
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const command = process.argv[2];
  const candidateId = process.argv[3];

  try {
    if (!command) {
      await interactiveMode();
      return;
    }

    if (command === "approve") {
      if (!candidateId) {
        console.error(
          color(
            "Usage: node cli-dashboard/approve.js approve <candidate_id>",
            RED
          )
        );
        process.exitCode = 1;
        return;
      }

      await approveCandidate(candidateId);
      return;
    }

    if (command === "reject") {
      if (!candidateId) {
        console.error(
          color(
            "Usage: node cli-dashboard/approve.js reject <candidate_id>",
            RED
          )
        );
        process.exitCode = 1;
        return;
      }

      await rejectCandidate(candidateId);
      return;
    }

    console.error(
      color(
        "Usage:\n" +
          "  node cli-dashboard/approve.js\n" +
          "  node cli-dashboard/approve.js approve <candidate_id>\n" +
          "  node cli-dashboard/approve.js reject <candidate_id>",
        RED
      )
    );

    process.exitCode = 1;
  } catch (error) {
    console.error(
      color(`\n✗ API request failed: ${error.message}\n`, RED)
    );

    process.exitCode = 1;
  }
}

main();