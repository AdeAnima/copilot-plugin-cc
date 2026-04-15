import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { createTempWorkspace, cleanupDir } from "./helpers.mjs";
import { resolveReviewTarget, collectReviewContext } from "../plugins/copilot/scripts/lib/git.mjs";

describe("git staged scope", () => {
  let tempDir;

  before(() => {
    tempDir = createTempWorkspace();
    execSync("git init", { cwd: tempDir });
    execSync("git config user.email test@test.com", { cwd: tempDir });
    execSync("git config user.name Test", { cwd: tempDir });
    fs.writeFileSync(path.join(tempDir, "initial.txt"), "initial content");
    execSync("git add . && git commit -m init", { cwd: tempDir });
  });

  after(() => cleanupDir(tempDir));

  it("resolveReviewTarget with scope=staged returns staged mode when changes are staged", () => {
    fs.writeFileSync(path.join(tempDir, "staged.txt"), "staged content");
    execSync("git add staged.txt", { cwd: tempDir });

    try {
      const target = resolveReviewTarget(tempDir, { scope: "staged" });
      assert.equal(target.mode, "staged");
      assert.equal(target.label, "staged changes");
      assert.equal(target.explicit, true);
    } finally {
      execSync("git reset HEAD staged.txt", { cwd: tempDir });
      fs.unlinkSync(path.join(tempDir, "staged.txt"));
    }
  });

  it("resolveReviewTarget with scope=staged throws when nothing is staged", () => {
    // Ensure no staged changes
    assert.throws(
      () => resolveReviewTarget(tempDir, { scope: "staged" }),
      /Nothing staged/
    );
  });

  it("collectReviewContext returns staged context with correct mode and content", () => {
    fs.writeFileSync(path.join(tempDir, "collect-staged.txt"), "collect staged content");
    execSync("git add collect-staged.txt", { cwd: tempDir });

    try {
      const target = resolveReviewTarget(tempDir, { scope: "staged" });
      const context = collectReviewContext(tempDir, target);
      assert.equal(context.mode, "staged");
      assert.ok(context.summary.includes("1 staged file"));
      assert.ok(context.content.includes("Staged Diff"));
    } finally {
      execSync("git reset HEAD collect-staged.txt", { cwd: tempDir });
      fs.unlinkSync(path.join(tempDir, "collect-staged.txt"));
    }
  });

  it("collectReviewContext staged content includes the actual diff", () => {
    fs.writeFileSync(path.join(tempDir, "diff-check.txt"), "diff check content");
    execSync("git add diff-check.txt", { cwd: tempDir });

    try {
      const target = resolveReviewTarget(tempDir, { scope: "staged" });
      const context = collectReviewContext(tempDir, target);
      assert.ok(context.content.includes("diff-check.txt"));
    } finally {
      execSync("git reset HEAD diff-check.txt", { cwd: tempDir });
      fs.unlinkSync(path.join(tempDir, "diff-check.txt"));
    }
  });
});
