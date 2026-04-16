import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveMode, computeSizeTier, detectClaudeConfig } from "../plugins/copilot/scripts/lib/guide-profile.mjs";

describe("resolveMode", () => {
  it("returns migration when codex plugin detected", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: true },
      pluginState: { jobsRun: 0, reviewGateEnabled: false },
      claudeConfig: { mentionsCopilot: false }
    });
    assert.equal(mode, "migration");
  });

  it("returns audit when gate is enabled", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: false },
      pluginState: { jobsRun: 0, reviewGateEnabled: true },
      claudeConfig: { mentionsCopilot: false }
    });
    assert.equal(mode, "audit");
  });

  it("returns audit when jobsRun > 5", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: false },
      pluginState: { jobsRun: 10, reviewGateEnabled: false },
      claudeConfig: { mentionsCopilot: false }
    });
    assert.equal(mode, "audit");
  });

  it("returns audit when CLAUDE.md mentions Copilot", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: false },
      pluginState: { jobsRun: 0, reviewGateEnabled: false },
      claudeConfig: { mentionsCopilot: true }
    });
    assert.equal(mode, "audit");
  });

  it("returns onboarding for fresh install", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: false },
      pluginState: { jobsRun: 0, reviewGateEnabled: false },
      claudeConfig: { mentionsCopilot: false }
    });
    assert.equal(mode, "onboarding");
  });

  it("migration takes priority over audit signals", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: true },
      pluginState: { jobsRun: 100, reviewGateEnabled: true },
      claudeConfig: { mentionsCopilot: true }
    });
    assert.equal(mode, "migration");
  });
});

describe("computeSizeTier", () => {
  it("tiny < 50", () => { assert.equal(computeSizeTier(0), "tiny"); });
  it("tiny at 49", () => { assert.equal(computeSizeTier(49), "tiny"); });
  it("small at 50", () => { assert.equal(computeSizeTier(50), "small"); });
  it("small at 499", () => { assert.equal(computeSizeTier(499), "small"); });
  it("medium at 500", () => { assert.equal(computeSizeTier(500), "medium"); });
  it("medium at 4999", () => { assert.equal(computeSizeTier(4999), "medium"); });
  it("large at 5000", () => { assert.equal(computeSizeTier(5000), "large"); });
  it("large at 49999", () => { assert.equal(computeSizeTier(49999), "large"); });
  it("huge at 50000", () => { assert.equal(computeSizeTier(50000), "huge"); });
});

describe("detectClaudeConfig", () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "guide-claude-")); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("returns claudeMdExists=false when missing", () => {
    const c = detectClaudeConfig(dir);
    assert.equal(c.claudeMdExists, false);
    assert.equal(c.claudeMdWritable, false);
    assert.equal(c.mentionsCopilot, false);
  });

  it("detects plain CLAUDE.md", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Project\nUse Bun.\n");
    const c = detectClaudeConfig(dir);
    assert.equal(c.claudeMdExists, true);
    assert.equal(c.claudeMdWritable, true);
    assert.equal(c.mentionsCopilot, false);
    assert.equal(c.mentionsSubagents, false);
    assert.equal(c.mentionsWorktrees, false);
    assert.equal(c.claudeMdHasManagedMarker, false);
  });

  it("detects Copilot mention", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Project\nRun /copilot:review.\n");
    const c = detectClaudeConfig(dir);
    assert.equal(c.mentionsCopilot, true);
  });

  it("detects sub-agent and worktree mentions", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "Dispatch sub-agent via worktree.\n");
    const c = detectClaudeConfig(dir);
    assert.equal(c.mentionsSubagents, true);
    assert.equal(c.mentionsWorktrees, true);
  });

  it("detects managed marker", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Managed by platform team\nDO NOT EDIT\n");
    const c = detectClaudeConfig(dir);
    assert.equal(c.claudeMdHasManagedMarker, true);
  });

  it("detects read-only file", () => {
    const p = path.join(dir, "CLAUDE.md");
    fs.writeFileSync(p, "content\n");
    fs.chmodSync(p, 0o444);
    const c = detectClaudeConfig(dir);
    assert.equal(c.claudeMdWritable, false);
  });
});
