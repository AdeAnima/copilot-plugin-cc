---
description: Interactive guide to set up or optimize the Copilot plugin for your workflow
argument-hint: '[--onboarding|--migration|--audit]'
allowed-tools: Read, Edit, Write, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" guide --json $ARGUMENTS
```

Parse the returned JSON profile. Use `profile.recommendedMode` to choose flow, unless `$ARGUMENTS` explicitly overrides with `--onboarding`, `--migration`, or `--audit`.

## Universal Rules

- Never silently write to files. Always show a proposed diff first, ask `Apply this change? (y/N/edit)`, and only write on `y`. If `edit`, print the content and let the user paste back a revised version, then apply.
- **Migration and Audit modes** end with the final summary block (see template at the bottom) listing: model (gpt-5.3-codex @ high effort), manual command (`/copilot:review`), disable command (`/plugin disable github-copilot`), where findings appear (terminal — pipe with `--json` for scripts), and logs path.
- **Onboarding mode** has its own conversational wrap-up (short summary + two before/after scenarios) — do not paste the template block there.
- Offer a `Try it now?` prompt at the end of every mode if the repo has staged changes — runs `/copilot:review --scope staged` via the Skill tool.

## Onboarding Mode (`profile.recommendedMode === "onboarding"`)

Treat this as a conversation, not a form. Use natural prose between tool calls — don't list the steps to the user or narrate what you're about to do. The numbered steps below are instructions for you, not a script to read out.

1. **Open with the context question.** In your own words, ask the user two things (one short message — don't batch into a rigid AskUserQuestion unless the environment requires it):
   - What do they already know about this plugin? (Have they used `/copilot:review` before, read the README, or is this fresh?)
   - How do they picture using it — occasional manual reviews, automatic on every commit, as a second opinion before shipping, or something else?

   Wait for their answer before proposing anything. If they say "not sure", give a one-paragraph plain-language explainer: Copilot reviews code using a different model family than Claude (so you get a genuinely independent second opinion), you trigger it with `/copilot:review`, and findings print to the terminal. Then re-ask how they'd like to use it.

2. **Translate their intent into concrete options, conversationally.** Based on what they said, respond with what you'd set up and why — not a menu dump. Example shape: "Given you want a safety net before shipping, I'd suggest A and B. I'd skip C because <reason>. Sound right?" Pull from these building blocks, only mentioning what fits their intent:

   - `Add Copilot section to CLAUDE.md` — include when CLAUDE.md is writable and doesn't already mention Copilot. If `profile.claudeConfig.claudeMdHasManagedMarker` is true OR `claudeMdExists && !claudeMdWritable`, offer `CLAUDE.local.md` or a printed cheatsheet instead, and say plainly why (their CLAUDE.md looks centrally managed / read-only).
   - `Auto-review on git commit` — local hook, only affects them.
   - `Auto-review on Claude stop hook` — local hook, only affects them.
   - `Sub-agent self-review pattern` — advanced; mention only if they described an agentic workflow or asked for deeper integration.
   - `Wire into existing pre-commit hook` — only if `profile.hooks.preCommit.present` is true. Flag that this modifies a shared repo file.
   - `CI integration guidance` — only if `profile.ciConfig.githubActions` is true.

   If their intent doesn't match any option, or points at something the plugin can't do, tell them directly and suggest the closest thing that *does* work.

   If `profile.repo.sizeTier` is `"large"` or `"huge"`, mention once in passing that reviews auto-fall-back to self-collect mode for diffs over the 256KB / 2-file threshold — built in, no config. Don't belabor it.

3. **Ask about the model.** One short question: which model do they want the review to use? Tell them the recommendation plainly: "The latest Codex model (`gpt-5.3-codex`) at `high` reasoning effort is the best pairing with Claude — it's a different family, so you get a real second opinion, and `high` catches issues `medium` misses. `xhigh` goes deeper but takes noticeably longer. Stick with the default, or pick another?" Accept their choice. If they pick something other than codex, don't argue — just note it in the summary.

4. **For each change, dry-run diff → confirm → apply.** Show the exact diff, ask `Apply this change? (y/N/edit)`, and only write on `y`. Don't batch confirmations. For pre-commit hooks, default to "append to existing hook" and "non-blocking warning" unless they say otherwise — but ask in the same breath as showing the diff, not as a separate step.

5. **Wrap up with a short summary and two scenario comparisons.** Keep the summary to 3-5 lines max — what's set up now, which model is configured, where findings go. Then give exactly two before/after workflow scenarios that match what they chose. No commands, no code blocks — just plain language. Examples of the *shape* (adapt to what they actually set up):

   - "Shipping a bugfix: *Before* — you'd finish the patch, eyeball the diff, push, and hope CI catches anything you missed. *Now* — the stop hook runs a Copilot pass automatically and flags the missing null check before you even type `git push`."
   - "Reviewing a teammate's PR locally: *Before* — you'd read the diff and trust your gut. *Now* — you run `/copilot:review --base main` and get a structured second opinion from a different model family in under a minute."

   End with: "Want to try it on your current staged changes?" — if they say yes, run `/copilot:review --scope staged` via the Skill tool.

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
   - `Customize (opens onboarding menu)`
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

Always end with this exact format (substituting applied items and values):

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
