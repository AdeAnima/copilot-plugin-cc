import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveMode, computeSizeTier } from "../plugins/copilot/scripts/lib/guide-profile.mjs";

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
