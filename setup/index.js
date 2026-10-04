import {
  checkDocker,
  checkDockerCompose,
  checkOllama,
  checkGemma
} from "../scripts/bootstrap/checks.js";

import {
  installDocker,
  installOllama,
  pullGemma
} from "../scripts/bootstrap/installers.js";

import { launchLoki } from "../scripts/bootstrap/launcher.js";

const GEMMA_MODEL = "gemma4:e2b";

function step(number, total, message) {
  console.log(`\n[${number}/${total}] ${message}`);
}

export async function runSetup() {
  console.log(`
╔══════════════════════════════════════╗
║           LOKI SETUP                 ║
║   No Log Left Behind.                ║
║   No Threat Left Hidden.             ║
╚══════════════════════════════════════╝
`);

  try {
    // --------------------------------------------------
    // 1. Docker
    // --------------------------------------------------
    step(1, 5, "Checking Docker");

    let docker = checkDocker();

    if (!docker.installed) {
      console.log("  ✗ Docker not found.");
      console.log("  → Installing Docker...");

      installDocker();

      docker = checkDocker();

      if (!docker.installed) {
        throw new Error("Docker installation completed, but Docker is still unavailable.");
      }

      console.log("  ✓ Docker installed.");
    } else {
      console.log(`  ✓ Docker ${docker.version}`);
    }

    if (!docker.running) {
      console.log("  → Docker daemon is not running.");
      console.log("  → Attempting to start Docker...");

      // Re-check after installer/start attempt.
      docker = checkDocker();

      if (!docker.running) {
        throw new Error(
          "Docker is installed but the Docker daemon is not running. Start Docker and run './loki setup' again."
        );
      }
    }

    console.log("  ✓ Docker daemon running.");

    // --------------------------------------------------
    // 2. Docker Compose
    // --------------------------------------------------
    step(2, 5, "Checking Docker Compose");

    const compose = checkDockerCompose();

    if (!compose.available) {
      throw new Error(
        "Docker Compose is unavailable. Please install the Docker Compose plugin and run './loki setup' again."
      );
    }

    console.log(`  ✓ Docker Compose ${compose.version}`);

    // --------------------------------------------------
    // 3. Ollama
    // --------------------------------------------------
    step(3, 5, "Checking Ollama");

    let ollama = checkOllama();

    if (!ollama.installed) {
      console.log("  ✗ Ollama not found.");
      console.log("  → Installing Ollama...");

      installOllama();

      ollama = checkOllama();

      if (!ollama.installed) {
        throw new Error("Ollama installation completed, but Ollama is still unavailable.");
      }

      console.log("  ✓ Ollama installed.");
    } else {
      console.log(`  ✓ Ollama ${ollama.version}`);
    }

    // --------------------------------------------------
    // 4. Gemma
    // --------------------------------------------------
    step(4, 5, `Checking Gemma 4 E2B (${GEMMA_MODEL})`);

    let gemma = checkGemma(GEMMA_MODEL);

    if (!gemma.available) {
      console.log(`  ✗ ${GEMMA_MODEL} not found locally.`);
      console.log(`  → Pulling ${GEMMA_MODEL}...`);

      pullGemma(GEMMA_MODEL);

      gemma = checkGemma(GEMMA_MODEL);

      if (!gemma.available) {
        throw new Error(
          `${GEMMA_MODEL} could not be verified after pulling the model.`
        );
      }

      console.log(`  ✓ ${GEMMA_MODEL} downloaded.`);
    } else {
      console.log(`  ✓ ${GEMMA_MODEL} already available.`);
    }

    // --------------------------------------------------
    // 5. Start Loki
    // --------------------------------------------------
    step(5, 5, "Starting Loki");

    launchLoki();

    console.log(`
╔══════════════════════════════════════╗
║          LOKI IS READY 🚀            ║
╚══════════════════════════════════════╝

Services:
  Elasticsearch  → http://localhost:9200
  Kibana         → http://localhost:5601
  Ollama         → local host service
  Gemma          → ${GEMMA_MODEL}

Run Loki normally with:

  npm start
`);

  } catch (error) {
    console.error(`
✗ Loki setup failed.

${error.message}
`);

    process.exitCode = 1;
  }
}
