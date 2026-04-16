import fs from "node:fs";
import path from "node:path";

import { getConfig, listJobs } from "./state.mjs";

export const AUDIT_JOBS_THRESHOLD = 5;

export function resolveMode(profile) {
  if (profile.otherPlugins?.codexPluginDetected) return "migration";

  const auditSignal =
    profile.pluginState?.reviewGateEnabled ||
    (profile.pluginState?.jobsRun ?? 0) > AUDIT_JOBS_THRESHOLD ||
    profile.claudeConfig?.mentionsCopilot;

  if (auditSignal) return "audit";
  return "onboarding";
}

export function computeSizeTier(fileCount) {
  if (fileCount >= 50000) return "huge";
  if (fileCount >= 5000) return "large";
  if (fileCount >= 500) return "medium";
  if (fileCount >= 50) return "small";
  return "tiny";
}

const MANAGED_MARKERS = [/managed by/i, /do not edit/i, /auto-?generated/i];

export function detectClaudeConfig(cwd) {
  const claudeMdPath = path.join(cwd, "CLAUDE.md");
  if (!fs.existsSync(claudeMdPath)) {
    return {
      claudeMdExists: false,
      claudeMdPath: null,
      claudeMdWritable: false,
      claudeMdHasManagedMarker: false,
      mentionsCopilot: false,
      mentionsSubagents: false,
      mentionsWorktrees: false
    };
  }
  let writable = false;
  try {
    fs.accessSync(claudeMdPath, fs.constants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }
  let content = "";
  try {
    content = fs.readFileSync(claudeMdPath, "utf8");
  } catch {
    content = "";
  }
  const lower = content.toLowerCase();
  return {
    claudeMdExists: true,
    claudeMdPath,
    claudeMdWritable: writable,
    claudeMdHasManagedMarker: MANAGED_MARKERS.some((rx) => rx.test(content)),
    mentionsCopilot: /copilot/i.test(content) || /\/copilot:/i.test(content),
    mentionsSubagents: /sub-?agent/i.test(lower),
    mentionsWorktrees: /worktree/i.test(lower)
  };
}

export function detectHooks(cwd) {
  const candidates = [
    { type: "husky", rel: ".husky/pre-commit" },
    { type: "pre-commit", rel: ".pre-commit-config.yaml" },
    { type: "lefthook", rel: "lefthook.yml" },
    { type: "lefthook", rel: "lefthook.yaml" },
    { type: "git", rel: ".git/hooks/pre-commit" }
  ];
  let preCommit = { present: false };
  for (const cand of candidates) {
    const p = path.join(cwd, cand.rel);
    if (fs.existsSync(p)) {
      preCommit = { present: true, type: cand.type, path: p };
      break;
    }
  }
  const stopHookPath = path.join(cwd, ".claude", "hooks", "stop.json");
  const sessionHookPath = path.join(cwd, ".claude", "hooks", "session-start.json");
  return {
    preCommit,
    stopHook: { present: fs.existsSync(stopHookPath) },
    sessionStartHook: { present: fs.existsSync(sessionHookPath) }
  };
}

export function detectCiConfig(cwd) {
  const wfDir = path.join(cwd, ".github", "workflows");
  if (!fs.existsSync(wfDir)) return { githubActions: false, detectedWorkflows: [] };
  let files = [];
  try {
    files = fs.readdirSync(wfDir)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .map((f) => path.join(".github", "workflows", f));
  } catch {
    files = [];
  }
  return { githubActions: files.length > 0, detectedWorkflows: files };
}

export function detectPluginState(workspaceRoot) {
  let reviewGateEnabled = false;
  let jobsRun = 0;
  try {
    const config = getConfig(workspaceRoot);
    reviewGateEnabled = Boolean(config?.stopReviewGate);
  } catch {
    reviewGateEnabled = false;
  }
  try {
    jobsRun = listJobs(workspaceRoot).length;
  } catch {
    jobsRun = 0;
  }
  return { reviewGateEnabled, jobsRun };
}

export function detectOtherPlugins(options = {}) {
  const home = options.home ?? process.env.HOME ?? "";
  const codexDir = path.join(home, ".claude", "plugins", "codex-plugin-cc");
  return {
    codexPluginDetected: fs.existsSync(codexDir)
  };
}
