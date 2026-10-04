import { execFileSync } from "node:child_process";

function runDockerCompose(args) {
  try {
    execFileSync("docker", ["compose", ...args], {
      stdio: "inherit"
    });

    return;
  } catch {
    // Retry through sudo if the current user cannot access Docker.
  }

  execFileSync("sudo", ["docker", "compose", ...args], {
    stdio: "inherit"
  });
}

export function launchLoki() {
  console.log("  → Running docker compose up -d...");

  runDockerCompose(["up", "-d"]);

  console.log("  ✓ Loki Docker services started.");
}
