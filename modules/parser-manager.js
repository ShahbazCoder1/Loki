import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory parser registry: Map<filename, parserObject>
const parsersMap = new Map();
let activeWatcher = null;
let activePoller = null;
let watcherDebounceTimer = null;
let defaultParsersDir = null;

/**
 * Get default parsers directory path
 */
export function getParsersDir(customDir) {
  if (customDir && fs.existsSync(customDir)) {
    return customDir;
  }
  const candidateDirs = [
    path.join(process.cwd(), "parsers"),
    path.join(__dirname, "../parsers"),
    path.join(__dirname, "../../parsers"),
    path.join(process.cwd(), "ulpf-prototype/parsers")
  ];

  for (const d of candidateDirs) {
    if (d && fs.existsSync(d) && fs.statSync(d).isDirectory()) {
      return d;
    }
  }
  return path.join(process.cwd(), "parsers");
}

/**
 * Safely parse a YAML file content
 */
function parseYamlFile(filePath, fileName) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    if (!content || !content.trim()) return null;

    const parsed = YAML.parse(content);
    if (parsed && typeof parsed === "object") {
      parsed._filename = fileName;
      if (!parsed.parser_id) {
        parsed.parser_id = path.basename(fileName, path.extname(fileName));
      }
      return parsed;
    }
  } catch (err) {
    // Ignore syntax errors during temporary file writes
  }
  return null;
}

/**
 * Load/Reload all parsers from directory into in-memory cache
 */
export function loadAllParsers(parsersDir) {
  const targetDir = getParsersDir(parsersDir);
  defaultParsersDir = targetDir;

  if (!fs.existsSync(targetDir)) {
    return Array.from(parsersMap.values());
  }

  try {
    const files = fs.readdirSync(targetDir);
    const currentFiles = new Set();

    for (const file of files) {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        currentFiles.add(file);
        const fullPath = path.join(targetDir, file);
        const parsed = parseYamlFile(fullPath, file);
        if (parsed) {
          parsersMap.set(file, parsed);
        }
      }
    }

    // Clean up deleted files from cache
    for (const cachedFile of parsersMap.keys()) {
      if (!currentFiles.has(cachedFile)) {
        parsersMap.delete(cachedFile);
      }
    }
  } catch (err) {
    // Graceful handling of directory read error
  }

  return Array.from(parsersMap.values());
}

/**
 * Get all loaded parser definitions as array
 */
export function getLoadedParsers() {
  if (parsersMap.size === 0) {
    loadAllParsers();
  }
  return Array.from(parsersMap.values());
}

/**
 * Get a specific parser definition by parser ID or filename
 */
export function getParser(parserId) {
  if (!parserId) return null;
  const allParsers = getLoadedParsers();

  for (const parser of allParsers) {
    if (
      parser.parser_id === parserId ||
      parser._filename === parserId ||
      path.basename(parser._filename || "", path.extname(parser._filename || "")) === parserId
    ) {
      return parser;
    }
  }
  return null;
}

/**
 * Start fs.watch on parsers directory for automatic hot reload
 */
export function startWatcher(parsersDir, debounceMs = 100) {
  const targetDir = getParsersDir(parsersDir);
  defaultParsersDir = targetDir;

  // Prevent duplicate watcher registrations
  stopWatcher();

  // Initial load
  loadAllParsers(targetDir);

  if (!fs.existsSync(targetDir)) return null;

  try {
    activeWatcher = fs.watch(targetDir, (eventType, filename) => {
      if (!filename || (!filename.endsWith(".yaml") && !filename.endsWith(".yml"))) {
        return;
      }

      // Debounce rapid filesystem events
      if (watcherDebounceTimer) {
        clearTimeout(watcherDebounceTimer);
      }

      watcherDebounceTimer = setTimeout(() => {
        const fullPath = path.join(targetDir, filename);

        if (!fs.existsSync(fullPath)) {
          // File deleted
          parsersMap.delete(filename);
        } else {
          // File created or modified
          const updatedParser = parseYamlFile(fullPath, filename);
          if (updatedParser) {
            parsersMap.set(filename, updatedParser);
          }
        }
      }, debounceMs);
    });

    // Handle watcher errors safely
    if (activeWatcher && typeof activeWatcher.on === "function") {
      activeWatcher.on("error", () => {});
    }
  } catch (err) {
    // Gracefully handle watcher failure
  }

  // fs.watch behavior differs across filesystems and container mounts. Polling
  // keeps hot reload reliable when native change notifications are dropped.
  activePoller = setInterval(() => {
    loadAllParsers(targetDir);
  }, Math.max(50, debounceMs));
  activePoller.unref?.();

  return activeWatcher;
}

/**
 * Stop active fs.watch watcher
 */
export function stopWatcher() {
  if (watcherDebounceTimer) {
    clearTimeout(watcherDebounceTimer);
    watcherDebounceTimer = null;
  }
  if (activeWatcher) {
    try {
      activeWatcher.close();
    } catch (_) {}
    activeWatcher = null;
  }
  if (activePoller) {
    clearInterval(activePoller);
    activePoller = null;
  }
}

/**
 * Reset internal cache (useful for testing)
 */
export function resetParsersCache() {
  stopWatcher();
  parsersMap.clear();
}

export default {
  loadAllParsers,
  getLoadedParsers,
  getParser,
  startWatcher,
  stopWatcher,
  resetParsersCache,
  getParsersDir
};
