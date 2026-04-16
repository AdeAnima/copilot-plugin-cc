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
