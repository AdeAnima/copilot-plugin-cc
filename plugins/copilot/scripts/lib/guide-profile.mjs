import fs from "node:fs";
import path from "node:path";

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
