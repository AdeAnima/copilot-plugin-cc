---
description: Set up or check the Copilot plugin — conversational onboarding on first run, quiet status on re-runs
argument-hint: '[--enable-review-gate|--disable-review-gate] [--status-only]'
allowed-tools: Read, Edit, Write, Bash(node:*), Bash(npm:*), Bash(git:*), AskUserQuestion
---

## Step 1 — CLI readiness

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" setup --json $ARGUMENTS
```

If the result says Copilot is unavailable and npm is available:
- Use `AskUserQuestion` exactly once to ask whether Claude should install Copilot CLI now.
- Put the install option first and suffix it with `(Recommended)`.
- Options: `Install Copilot CLI (Recommended)` / `Skip for now`.
- If install: run `npm install -g @github/copilot-cli`, then rerun the setup command above.

If Copilot CLI is already installed or npm is unavailable, skip the install prompt.

If Copilot CLI is installed but not authenticated, preserve the guidance to run `!copilot login` and stop here — the rest of the flow needs auth.

## Step 2 — Route by profile

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" guide --json
```

Parse the JSON. Use `profile.recommendedMode` to decide what to do next:

- If `$ARGUMENTS` contains `--status-only`: skip onboarding/migration, print a short status recap (gate state, model default, recent activity if any), then stop.
- If `recommendedMode === "onboarding"`: run **Onboarding** below inline.
- If `recommendedMode === "migration"`: point the user at `/copilot:guide --migration` for the codex → copilot migration walkthrough. Don't run migration inline from `/copilot:setup`.
- If `recommendedMode === "audit"`: print a short status recap (same as `--status-only`) and suggest `/copilot:guide --audit` if they want the full diagnostics dashboard.

## Onboarding (inline)

Treat this as a conversation, not a form. Use natural prose between tool calls — don't list steps to the user or narrate what you're about to do. The numbered items below are instructions for you, not a script to read out.

1. **Open with the context question.** In your own words, ask the user two things (one short message):
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
   - `Review gate` (enable/disable) — if the user wants auto-review on stop or commit, the session-scoped review gate should typically be ON. Mention this in the same breath, and plan to toggle it with `/copilot:setup --enable-review-gate` as part of the applied changes.

   If their intent doesn't match any option, or points at something the plugin can't do, tell them directly and suggest the closest thing that *does* work.

   If `profile.repo.sizeTier` is `"large"` or `"huge"`, mention once in passing that reviews auto-fall-back to self-collect mode for diffs over the 256KB / 2-file threshold — built in, no config. Don't belabor it.

3. **Ask about the model.** One short question: which model do they want the review to use? Tell them the recommendation plainly: "The latest Codex model (`gpt-5.3-codex`) at `high` reasoning effort is the best pairing with Claude — it's a different family, so you get a real second opinion, and `high` catches issues `medium` misses. `xhigh` goes deeper but takes noticeably longer. Stick with the default, or pick another?" Accept their choice. If they pick something other than codex, don't argue — just note it in the summary.

4. **For each change, dry-run diff → confirm → apply.** Show the exact diff, ask `Apply this change? (y/N/edit)`, and only write on `y`. Don't batch confirmations. For pre-commit hooks, default to "append to existing hook" and "non-blocking warning" unless they say otherwise — but ask in the same breath as showing the diff, not as a separate step.

5. **Wrap up with a short summary and two scenario comparisons.** Keep the summary to 3-5 lines max — what's set up now, which model is configured, where findings go. Then give exactly two before/after workflow scenarios that match what they chose. No commands, no code blocks — just plain language. Examples of the *shape* (adapt to what they actually set up):

   - "Shipping a bugfix: *Before* — you'd finish the patch, eyeball the diff, push, and hope CI catches anything you missed. *Now* — the stop hook runs a Copilot pass automatically and flags the missing null check before you even type `git push`."
   - "Reviewing a teammate's PR locally: *Before* — you'd read the diff and trust your gut. *Now* — you run `/copilot:review --base main` and get a structured second opinion from a different model family in under a minute."

   End with: "Want to try it on your current staged changes?" — if they say yes, run `/copilot:review --scope staged` via the Skill tool.

## Status recap (returning users / audit / `--status-only`)

Print a compact block — not the full summary template:

```
Copilot plugin: ready
  Model:     gpt-5.3-codex @ high effort (default for reviews)
  Gate:      [ON/OFF]
  CLAUDE.md: [mentions Copilot / does not mention / not writable]
  Activity:  <N> reviews in the last 30 days (from jobSummary)
  More:      /copilot:guide --audit for full diagnostics, /copilot:review to run a review now
```

If the repo has staged changes, offer "Want to try it on your current staged changes?" at the end — runs `/copilot:review --scope staged` via the Skill tool.

## Universal Rules

- Never silently write to files. Always show a proposed diff first, ask `Apply this change? (y/N/edit)`, and only write on `y`. If `edit`, print the content and let the user paste back a revised version, then apply.
- Never leave partial state: if a write fails midway, report which succeeded and which did not.
- If `profile.repo.isGitRepo === false`: proceed with the CLI readiness check and auth guidance, but skip onboarding — tell the user the rest of the setup needs a git repo.
