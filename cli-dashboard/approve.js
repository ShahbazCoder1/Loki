import readline from "readline";

const API_BASE = process.env.ULPF_API_URL;

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

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    let data = null;

    try {
        data = await response.json();
    } catch {
        // Empty/non-JSON response
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
    const data = await apiRequest(
        "/api/intelligence/candidates"
    );

    return data?.candidates || [];
}

/* -------------------------------------------------------------------------- */
/* CANDIDATE TABLE                                                            */
/* -------------------------------------------------------------------------- */

function printCandidateTable(candidates) {
    console.log();
    console.log(
        color("CANDIDATE PARSER APPROVAL", BOLD + CYAN)
    );
    console.log();

    const widths = {
        number: 4,
        id: 30,
        device: 20,
        cluster: 8,
        tests: 10,
        status: 12,
    };

    const top =
        `┌${"─".repeat(widths.number + 2)}` +
        `┬${"─".repeat(widths.id + 2)}` +
        `┬${"─".repeat(widths.device + 2)}` +
        `┬${"─".repeat(widths.cluster + 2)}` +
        `┬${"─".repeat(widths.tests + 2)}` +
        `┬${"─".repeat(widths.status + 2)}┐`;

    const middle =
        `├${"─".repeat(widths.number + 2)}` +
        `┼${"─".repeat(widths.id + 2)}` +
        `┼${"─".repeat(widths.device + 2)}` +
        `┼${"─".repeat(widths.cluster + 2)}` +
        `┼${"─".repeat(widths.tests + 2)}` +
        `┼${"─".repeat(widths.status + 2)}┤`;

    const bottom =
        `└${"─".repeat(widths.number + 2)}` +
        `┴${"─".repeat(widths.id + 2)}` +
        `┴${"─".repeat(widths.device + 2)}` +
        `┴${"─".repeat(widths.cluster + 2)}` +
        `┴${"─".repeat(widths.tests + 2)}` +
        `┴${"─".repeat(widths.status + 2)}┘`;

    function row(
        number,
        candidateId,
        deviceFamily,
        cluster,
        tests,
        status
    ) {
        return (
            `│ ${truncate(number, widths.number)} │ ` +
            `${truncate(candidateId, widths.id)} │ ` +
            `${truncate(deviceFamily, widths.device)} │ ` +
            `${truncate(cluster, widths.cluster)} │ ` +
            `${truncate(tests, widths.tests)} │ ` +
            `${truncate(status, widths.status)} │`
        );
    }

    console.log(top);

    console.log(
        row(
            "#",
            "Candidate ID",
            "Device Family",
            "Cluster",
            "Tests",
            "Status"
        )
    );

    console.log(middle);

    candidates.forEach((candidate, index) => {
        const positive = candidate.test_results?.positive;

        const tests = positive
            ? `${positive.passed}/${positive.total}`
            : "-";

        console.log(
            row(
                index + 1,
                candidate.candidate_id,
                candidate.device_family,
                candidate.cluster_size,
                tests,
                candidate.status
            )
        );
    });

    console.log(bottom);
}

/* -------------------------------------------------------------------------- */
/* CANDIDATE DETAILS                                                          */
/* -------------------------------------------------------------------------- */

function printCandidateDetails(candidate) {
    const parser = candidate.candidate || {};
    const detection = parser.detection || {};
    const tests = candidate.test_results || {};

    const positive = tests.positive || {};
    const negative = tests.negative || {};

    const details = [
        `Candidate ID : ${candidate.candidate_id || "-"}`,
        `Parser ID    : ${parser.parser_id || "-"}`,
        `Version      : ${parser.version || "-"}`,
        `Device Family: ${parser.device_family || "-"}`,
        `Cluster Size : ${candidate.cluster_size ?? "-"}`,
        `Status       : ${candidate.status || "-"}`,
        `Generated    : ${parser.is_generated ? "YES" : "NO"}`,
        `Source       : ${parser.source || "-"}`,
    ];

    const title = " LOKI PARSER CANDIDATE ";

    // Calculate the box width from the longest actual line.
    const innerWidth = Math.max(
        58,
        title.length,
        ...details.map((line) => line.length)
    );

    const horizontal = "─".repeat(innerWidth);

    console.log();

    console.log(
        color(`╔${horizontal}╗`, CYAN)
    );

    console.log(
        color(
            `║${title.padEnd(innerWidth)}║`,
            BOLD + CYAN
        )
    );

    console.log(
        color(`╠${horizontal}╣`, CYAN)
    );

    for (const line of details) {
        console.log(
            `║${line.padEnd(innerWidth)}║`
        );
    }

    console.log(
        color(`╚${horizontal}╝`, CYAN)
    );

    /* ------------------------------ Detection ----------------------------- */

    console.log();
    console.log(
        color("1. DETECTION", BOLD + CYAN)
    );

    console.log(
        `Structure : ${detection.structure || "-"}`
    );

    console.log(
        `Keywords  : ${
            (detection.keywords || []).join(", ") || "-"
        }`
    );

    if (detection.signatures?.length) {
        console.log("Signatures:");

        for (const signature of detection.signatures) {
            console.log(`  • ${signature}`);
        }
    }

    /* --------------------------- Extraction Rules ------------------------- */

    console.log();
    console.log(
        color("2. EXTRACTION RULES", BOLD + CYAN)
    );

    if (parser.extraction_rules?.length) {
        for (const rule of parser.extraction_rules) {
            console.log(
                `  ${rule.field}: ${rule.regex}`
            );
        }
    } else {
        console.log("  None");
    }

    /* ---------------------------- Required Fields ------------------------- */

    console.log();
    console.log(
        color("3. REQUIRED FIELDS", BOLD + CYAN)
    );

    console.log(
        `  ${
            (parser.required_fields || []).join(", ") ||
            "None"
        }`
    );

    /* ------------------------- Normalization Mapping ---------------------- */

    console.log();
    console.log(
        color(
            "4. NORMALIZATION MAPPING",
            BOLD + CYAN
        )
    );

    const mappings =
        parser.normalization_mapping || {};

    if (Object.keys(mappings).length) {
        for (const [from, to] of Object.entries(mappings)) {
            console.log(`  ${from} → ${to}`);
        }
    } else {
        console.log("  None");
    }

    /* ------------------------------ Test Results -------------------------- */

    console.log();
    console.log(
        color("5. TEST RESULTS", BOLD + CYAN)
    );

    console.log(
        `  Positive: ${
            positive.passed ?? 0
        }/${positive.total ?? 0} passed`
    );

    console.log(
        `  Negative: ${
            negative.correctly_rejected ?? 0
        }/${negative.total ?? 0} rejected`
    );

    console.log(
        `  Overall : ${
            tests.overall_pass
                ? color("PASS", GREEN)
                : color("FAIL", RED)
        }`
    );

    console.log();
}

/* -------------------------------------------------------------------------- */
/* APPROVE / REJECT                                                           */
/* -------------------------------------------------------------------------- */

async function approveCandidate(candidateId) {
    console.log(
        `\nApproving candidate ${color(
            candidateId,
            CYAN
        )}...\n`
    );

    const result = await apiRequest(
        "/api/intelligence/approve",
        {
            method: "POST",
            body: JSON.stringify({
                candidate_id: candidateId,
            }),
        }
    );

    console.log(
        color(
            "✓ Candidate approved successfully.",
            GREEN
        )
    );

    if (result?.message) {
        console.log(result.message);
    }

    console.log();
}

async function rejectCandidate(candidateId) {
    console.log(
        `\nRejecting candidate ${color(
            candidateId,
            CYAN
        )}...\n`
    );

    const result = await apiRequest(
        "/api/intelligence/reject",
        {
            method: "POST",
            body: JSON.stringify({
                candidate_id: candidateId,
            }),
        }
    );

    console.log(
        color(
            "✓ Candidate rejected successfully.",
            YELLOW
        )
    );

    if (result?.message) {
        console.log(result.message);
    }

    console.log();
}

/* -------------------------------------------------------------------------- */
/* READLINE                                                                   */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* INTERACTIVE MODE                                                           */
/* -------------------------------------------------------------------------- */

async function interactiveMode() {
    const candidates = await getCandidates();

    if (!candidates.length) {
        console.log(
            color(
                "\nNo pending candidates found.\n",
                YELLOW
            )
        );

        return;
    }

    printCandidateTable(candidates);

    const rl = createReadline();

    try {
        const answer = await ask(
            rl,
            "\nSelect a candidate number: "
        );

        const index =
            Number.parseInt(answer.trim(), 10) - 1;

        if (
            Number.isNaN(index) ||
            index < 0 ||
            index >= candidates.length
        ) {
            console.log(
                color(
                    "\nInvalid candidate selection.\n",
                    RED
                )
            );

            return;
        }

        const candidate = candidates[index];

        // IMPORTANT:
        // Actually call the details function.
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

            if (
                action === "a" ||
                action === "approve"
            ) {
                await approveCandidate(
                    candidate.candidate_id
                );

                return;
            }

            if (
                action === "r" ||
                action === "reject"
            ) {
                await rejectCandidate(
                    candidate.candidate_id
                );

                return;
            }

            if (
                action === "b" ||
                action === "back"
            ) {
                console.log("\nReturning...\n");
                return;
            }

            console.log(
                color(
                    "\nPlease enter A, R, or B.\n",
                    YELLOW
                )
            );
        }
    } finally {
        rl.close();
    }
}

/* -------------------------------------------------------------------------- */
/* MAIN                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
    const command = process.argv[2];
    const candidateId = process.argv[3];

    try {
        /* ------------------------- Interactive mode ----------------------- */

        if (!command) {
            await interactiveMode();
            return;
        }

        /* --------------------------- Direct approve ----------------------- */

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

        /* ---------------------------- Direct reject ----------------------- */

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

        /* ------------------------------ Usage ----------------------------- */

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
            color(
                `\n✗ API request failed: ${error.message}\n`,
                RED
            )
        );

        process.exitCode = 1;
    }
}

main();