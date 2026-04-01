import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "plugins",
  "copilot",
  "scripts",
  "copilot-companion.mjs"
);

describe("copilot-companion CLI", () => {
  it("prints usage for help", () => {
    const result = execSync(`node ${SCRIPT} help`, { encoding: "utf8" });
    assert.match(result, /Usage:/);
    assert.match(result, /copilot-companion/);
  });

  it("prints usage for --help", () => {
    const result = execSync(`node ${SCRIPT} --help`, { encoding: "utf8" });
    assert.match(result, /Usage:/);
  });

  it("exits with error for unknown subcommand", () => {
    assert.throws(() => execSync(`node ${SCRIPT} nonexistent`, { encoding: "utf8" }), /Unknown subcommand/);
  });
});
