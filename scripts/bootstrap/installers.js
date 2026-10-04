import { execFileSync } from "node:child_process";

function run(command, args = [], options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options
  });
}

function runShell(command) {
  run("bash", ["-c", command]);
}

function commandExists(command) {
  try {
    execFileSync("bash", ["-lc", `command -v ${command}`], {
      stdio: "ignore"
    });

    return true;
  } catch {
    return false;
  }
}

export function installDocker() {
  console.log("  Installing Docker using the official Docker installer...");

  if (commandExists("curl")) {
    runShell("curl -fsSL https://get.docker.com | sh");
  } else {
    throw new Error(
      "curl is required to install Docker automatically. Install curl and run './loki setup' again."
    );
  }

  // Start Docker immediately where systemd is available.
  try {
    run("sudo", ["systemctl", "enable", "--now", "docker"]);
  } catch {
    // Docker may already be running or the environment may not use systemd.
  }

  console.log("  ✓ Docker installation finished.");
}

export function installOllama() {
  console.log("  Installing Ollama...");

  if (!commandExists("curl")) {
    throw new Error(
      "curl is required to install Ollama automatically. Install curl and run './loki setup' again."
    );
  }

  runShell("curl -fsSL https://ollama.com/install.sh | sh");

  // On Linux, the installer normally creates the Ollama service.
  try {
    run("sudo", ["systemctl", "enable", "--now", "ollama"]);
  } catch {
    // The service may already be running or systemd may be unavailable.
  }

  console.log("  ✓ Ollama installation finished.");
}

export function pullGemma(model) {
  console.log(`  Downloading ${model}.`);
  console.log("  This may take some time depending on your connection.");

  run("ollama", ["pull", model]);

  console.log(`  ✓ ${model} pull completed.`);
}
