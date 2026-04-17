---
description: Migration walkthrough (codex → copilot) or diagnostics audit of the Copilot plugin setup
argument-hint: '[--migration|--audit]'
allowed-tools: Read, Edit, Write, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" guide --json $ARGUMENTS
```

Parse the returned JSON profile. Route based on `$ARGUMENTS` (explicit override) or `profile.recommendedMode`:

- `--migration` or `recommendedMode === "migration"` → Migration mode
- `--audit` or `recommendedMode === "audit"` → Audit mode
- `recommendedMode === "onboarding"` → tell the user onboarding lives in `/copilot:setup` and suggest they run that instead. Don't duplicate the onboarding flow here.

## Universal Rules

- Never silently write to files. Always show a proposed diff first, ask `Apply this change? (y/N/edit)`, and only write on `y`. If `edit`, print the content and let the user paste back a revised version, then apply.
- End Migration and Audit modes with the final summary block (see template at the bottom) listing: model (gpt-5.3-codex @ high effort), manual command (`/copilot:review`), disable command (`/plugin disable github-copilot`), where findings appear (terminal — pipe with `--json` for scripts), and logs path.
- Offer a `Try it now?` prompt at the end if the repo has staged changes — runs `/copilot:review --scope staged` via the Skill tool.

## Migration Mode (`profile.recommendedMode === "migration"`)

1. Show the differences block:

```
Detected: codex-plugin-cc installed.
This plugin works the same way. Differences:
  - Model: gpt-5.3-codex @ high effort (Copilot's default) vs Codex's o-series
  - Delegation defaults to read-only (--write opt-in for edits)
  - Sub-agent self-review pattern is built-in
  - Auth: uses your Copilot CLI license
```

2. Run `/copilot:setup --json` to verify auth. Append a line: `Auth: verified ✓` or `Auth: ⚠ not authenticated — run !copilot login first`.

3. AskUserQuestion with these options:
   - `Apply equivalent setup (Recommended)`
   - `Customize (opens /copilot:setup onboarding)`
   - `Show me the full mapping first (dry-run)`

4. If "Show mapping", print the proposed changes (model bindings, default flags, CLAUDE.md snippet diff) without writing. Then re-ask: `Apply these? y/N`.

5. If "Apply equivalent", back up codex config to `.copilot/codex-backup-<ISO-timestamp>.json`. Apply the equivalent settings one by one with individual consent (skip the dry-run re-confirm since user already chose apply). Always include `--restore-codex` in the final summary so the user can roll back.

6. Final summary + "Try it now?" prompt.

## Audit Mode (`profile.recommendedMode === "audit"`)

1. The `guide --json` output already includes `jobSummary` (totals for the last 30 days) alongside the profile. If you also need current runtime status, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" status --json
```

2. Render a diagnostics dashboard with five sections:

   - **Active Config** — current gate state, CLAUDE.md mentions, hooks installed, diff threshold (from profile + status).
   - **Recent Activity** — totals from `jobSummary` (last 30 days): reviews run (`jobSummary.byKind.review ?? 0`), adversarial (`jobSummary.byKind.adversarial ?? 0`), rescue/task (`jobSummary.byKind.task ?? 0`), total jobs (`jobSummary.totalJobs`), avg duration in seconds (`jobSummary.avgDurationMs / 1000`).
   - **Drift Detected** — one entry per detected drift, each with a "Why flagged" line citing evidence. Check:
     - Has GitHub Actions but no Copilot CI integration (evidence: `profile.ciConfig.githubActions === true` and no Copilot step detected in workflows)
     - CLAUDE.md missing commands added after the file's last modification date (skip if we can't determine — this is optional detection)
   - **Unused Capabilities** — one entry per unused feature with "Why flagged":
     - `/copilot:adversarial-review` if `(jobSummary.byKind.adversarial ?? 0) === 0`
     - Rescue/task delegation if `(jobSummary.byKind.task ?? 0) === 0`
     - Sub-agent self-review if `profile.claudeConfig.mentionsSubagents === true` but sub-agent review pattern not found in CLAUDE.md
   - **Tuning Opportunities** — data-driven nudges based on `profile.repo.recentCommits`:
     - If `changesetMedianLines > 0` and current diff threshold significantly exceeds `p95Lines`, suggest lower threshold with both numbers cited.

3. AskUserQuestion: "Apply any tuning?" with pickable items derived from the drift/unused/tuning sections.

4. For each picked item: dry-run → confirm → apply. Any write still shows the exact diff.

5. Final summary includes: changes applied, log location (`$CLAUDE_PLUGIN_DATA/state/<workspace>/jobs/` or system tmpdir fallback), changelog link for plugin updates, and optional "Schedule next audit in 30 days?" prompt (no-op if user declines — we don't have scheduling yet, just surface the reminder option).

## Error Handling

- If `profile.repo.isGitRepo === false`: exit with "This command must run inside a Git repository. Try `/copilot:setup` first." and do not proceed.
- If the companion JSON parse fails: exit with the raw stderr from the script.
- If a user cancels a dry-run confirmation, skip that change and continue with the next.
- Never leave partial state: if a write fails midway, report which succeeded and which did not.

## Final Summary Template

End Migration and Audit with this format (substituting applied items and values):

```
## Setup Complete

Applied:
  - <item 1> (<file/path>)
  - <item 2> (<file/path>)

Reference:
  - Model:    gpt-5.3-codex @ high effort (~$0.02/review, varies with diff size)
  - Manual:   /copilot:review
  - Disable:  /plugin disable github-copilot (via Claude Code)
  - Findings: printed to terminal (pipe with --json for scripts)
  - Logs:     $CLAUDE_PLUGIN_DATA/state/<workspace>/jobs/ (or system tmpdir if env var not set)

Next: want to run /copilot:review on your current staged changes? [y/N]
```
