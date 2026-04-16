import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "plugins", "copilot", "scripts", "copilot-companion.mjs"
);

describe("guide subcommand", () => {
  it("returns JSON profile with recommendedMode", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guide-sub-"));
    try {
      execSync("git init -q", { cwd: dir });
      execSync('git config user.email "t@t.io"', { cwd: dir });
      execSync('git config user.name "T"', { cwd: dir });
      fs.writeFileSync(path.join(dir, "a.txt"), "x\n");
      execSync("git add -A && git commit -q -m init", { cwd: dir });
      const home = fs.mkdtempSync(path.join(os.tmpdir(), "guide-home-"));
      try {
        const out = execFileSync("node", [SCRIPT, "guide", "--json", `--cwd=${dir}`], {
          env: { ...process.env, HOME: home },
          encoding: "utf8"
        });
        const parsed = JSON.parse(out);
        assert.ok(parsed.repo);
        assert.ok(parsed.claudeConfig);
        assert.ok(["onboarding", "migration", "audit"].includes(parsed.recommendedMode));
        assert.ok(parsed.jobSummary);
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
