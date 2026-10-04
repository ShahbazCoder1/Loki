import { execFileSync } from "node:child_process";

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

function run(command, args = []) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    return null;
  }
}

function runWithSudo(command, args = []) {
  try {
    return execFileSync("sudo", [command, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    return null;
  }
}

export function checkDocker() {
  if (!commandExists("docker")) {
    return {
      installed: false,
      running: false,
      version: null
    };
  }

  const version =
    run("docker", ["--version"]) ||
    runWithSudo("docker", ["--version"]);

  const running =
    run("docker", ["info"]) !== null ||
    runWithSudo("docker", ["info"]) !== null;

  return {
    installed: true,
    running,
    version
  };
}

export function checkDockerCompose() {
  const version =
    run("docker", ["compose", "version"]) ||
    runWithSudo("docker", ["compose", "version"]);

  return {
    available: version !== null,
    version
  };
}

export function checkOllama() {
  if (!commandExists("ollama")) {
    return {
      installed: false,
      running: false,
      version: null
    };
  }

  const version = run("ollama", ["--version"]);

  // `ollama list` also verifies that the Ollama service is usable.
  const running = run("ollama", ["list"]) !== null;

  return {
    installed: true,
    running,
    version
  };
}

export function checkGemma(model) {
  if (!commandExists("ollama")) {
    return {
      available: false
    };
  }

  const models = run("ollama", ["list"]);

  if (!models) {
    return {
      available: false
    };
  }

  const lines = models
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const available = lines.some(line => {
    const name = line.split(/\s+/)[0];
    return name === model;
  });

  return {
    available
  };
}
