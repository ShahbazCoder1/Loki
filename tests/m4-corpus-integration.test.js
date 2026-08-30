import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { processLogPipeline } from "../modules/pipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function samplesFor(name) {
  return JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "test-logs", name, "samples.json"),
    "utf-8"
  ));
}

test("M4 integration normalizes and exports every parser-valid corpus event", async () => {
  let parserValidCount = 0;

  for (const corpus of ["cisco_asa", "fortinet", "cef"]) {
    for (const sample of samplesFor(corpus)) {
      const result = await processLogPipeline(sample, { skipExporter: true });
      if (result.parseResult?.validationStatus === "FAIL") continue;

      parserValidCount++;
      assert.equal(result.status, "exported", `${corpus} event failed: ${result.reason || sample}`);
      assert.equal(result.schemaCheck.valid, true);
      assert.equal(result.event.processing_status, "EXPORTED");
      assert.equal(result.event.normalized.schema_validation_status, "PASS");
      assert.ok(Object.keys(result.event.field_lineage).length > 0);
      assert.ok(result.event.provenance.some(entry => entry.stage === "normalize"));
      assert.ok(result.event.provenance.some(entry => entry.stage === "validate"));
      assert.ok(result.event.provenance.some(entry => entry.stage === "export"));
    }
  }

  assert.equal(parserValidCount, 42);
});
