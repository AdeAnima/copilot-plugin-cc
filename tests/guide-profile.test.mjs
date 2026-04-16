import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveMode } from "../plugins/copilot/scripts/lib/guide-profile.mjs";

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
