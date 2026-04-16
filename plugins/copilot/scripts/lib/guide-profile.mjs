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
