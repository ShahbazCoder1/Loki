import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { processLogPipeline } from "../modules/pipeline.js";

test("Python Log Simulator - Generates valid logs and resolves/quarantines correctly", async () => {
  const pyOneLiner = "import json; from simulator import random_cisco_asa, random_fortinet, random_cef, random_unknown, capture_real_host_logs; print(json.dumps({'cisco': [random_cisco_asa() for _ in range(5)], 'fortinet': [random_fortinet() for _ in range(5)], 'cef': [random_cef() for _ in range(5)], 'unknown': [random_unknown() for _ in range(3)], 'real': capture_real_host_logs(3)}))";

  const stdout = execSync(`python -c "${pyOneLiner}"`, {
    cwd: "log-simulator",
    encoding: "utf-8"
  });

  const generated = JSON.parse(stdout.trim());

  // 1. Verify Cisco ASA logs parse & export
  for (const ciscoLog of generated.cisco) {
    const res = await processLogPipeline(ciscoLog, { skipExporter: true });
    assert.strictEqual(res.status, "exported", `Cisco log failed: ${ciscoLog}`);
    assert.strictEqual(res.event.source.type, "cisco_asa_v1.0");
  }

  // 2. Verify Fortinet logs parse & export
  for (const fortinetLog of generated.fortinet) {
    const res = await processLogPipeline(fortinetLog, { skipExporter: true });
    assert.strictEqual(res.status, "exported", `Fortinet log failed: ${fortinetLog}`);
    assert.strictEqual(res.event.source.type, "fortinet_v1.0");
  }

  // 3. Verify CEF logs parse & export
  for (const cefLog of generated.cef) {
    const res = await processLogPipeline(cefLog, { skipExporter: true });
    assert.strictEqual(res.status, "exported", `CEF log failed: ${cefLog}`);
    assert.strictEqual(res.event.source.type, "generic_cef_v1.0");
  }

  // 4. Verify Unknown synthetic logs quarantine safely
  for (const unknownLog of generated.unknown) {
    const res = await processLogPipeline(unknownLog, { skipExporter: true });
    assert.strictEqual(res.status, "quarantined", `Unknown log did not quarantine: ${unknownLog}`);
  }

  // 5. Verify Real Host logs quarantine safely (proving live real log quarantine)
  for (const realLog of generated.real) {
    const res = await processLogPipeline(realLog, { skipExporter: true });
    assert.strictEqual(res.status, "quarantined", `Real host log did not quarantine: ${realLog}`);
  }
});
