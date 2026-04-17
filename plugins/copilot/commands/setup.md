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

Treat this as a conversation. **Strict rule: one question per round.** Each question must offer 2 or 3 quick-pick options labeled `a)`, `b)`, `c)` plus a trailing `d) something else` escape hatch. The user can type a single letter to answer. If they pick `d`, ask one follow-up to capture their intent in their own words, then map it to the closest available option (or tell them plainly if it isn't supported).

Between questions, react to the previous answer in one short sentence — don't summarize, don't preview what's next. Use natural prose; never dump the full menu.

**Mandatory ordering.** Ask in this order. Skip a question entirely if the profile makes it irrelevant (noted inline). Never batch.

**Q1 — Familiarity.**
> How familiar are you with this plugin?
> a) New to it — give me the short version
> b) Read the README, haven't used it yet
> c) I've run `/copilot:review` before
> d) Something else

If `a`: give a one-paragraph plain-language explainer (Copilot reviews code using a different model family than Claude, so you get a genuinely independent second opinion; you trigger it with `/copilot:review`; findings print to the terminal). Then continue to Q2.

**Q2 — Primary use case.**
> How do you picture using it?
> a) Manual second opinion before I ship
> b) Automatic on every commit / Claude stop
> c) Occasional deep adversarial pass
> d) Something else

Their pick narrows which hooks and settings to suggest later — remember it.

**Q3 — Model.**
> Which model should reviews use by default?
> a) gpt-5.3-codex @ high effort (Recommended — latest Codex, different family from Claude, best pairing)
> b) gpt-5.3-codex @ xhigh effort (deeper, noticeably slower)
> c) Keep Copilot's default (no override)
> d) Something else

**Q4 — CLAUDE.md guidance.** Skip if `profile.claudeConfig.mentionsCopilot === true`. If `claudeMdHasManagedMarker` is true OR `claudeMdExists && !claudeMdWritable`, swap option `a` to the fallback below and mention in one sentence why.
> Want me to add a short Copilot section to your CLAUDE.md?
> a) Yes — append to CLAUDE.md *(or: `a) Create CLAUDE.local.md instead — your CLAUDE.md is read-only / centrally managed`)*
> b) No — print me a one-page cheatsheet instead
> c) Skip
> d) Something else

**Q5 — Automation.** Only ask if Q2 was `b` (automatic) or they explicitly asked for hooks. Otherwise skip.
> Where should auto-review run?
> a) On git commit (local hook)
> b) On Claude stop (local hook)
> c) Both
> d) Something else

If `profile.hooks.preCommit.present` is true and they pick `a` or `c`, follow up with one more question:
> A pre-commit hook already exists. How should I wire in?
> a) Append — run after your current hook, non-blocking warning (Recommended)
> b) Append — hard fail if Copilot finds issues
> c) Don't touch it — skip the commit hook
> d) Something else

**Q6 — Review gate.** Skip if Q5 was skipped entirely.
> Auto-review usually needs the session review gate ON. Enable it?
> a) Yes, enable now
> b) No, leave it off (I'll toggle manually)
> c) Something else

**Q7 — Advanced extras.** Only ask if `profile.claudeConfig.mentionsSubagents === true` OR `profile.ciConfig.githubActions === true`. Offer only the options whose conditions hold.
> Anything else to wire up?
> a) Sub-agent self-review pattern *(only if `mentionsSubagents`)*
> b) CI integration guidance *(only if `githubActions`)*
> c) Skip
> d) Something else

If `profile.repo.sizeTier` is `"large"` or `"huge"`, mention once — in one sentence before Q4 or after Q7, wherever flows best — that reviews auto-fall-back to self-collect mode for diffs over the 256KB / 2-file threshold. Don't make it a question.

**Apply changes.** For every change: show the exact diff, ask `Apply this change? (y/N/edit)`, and only write on `y`. One diff at a time — don't batch confirmations.

**Wrap up.** Short summary (3-5 lines max) of what's set up, which model is configured, and where findings go. Then exactly two before/after workflow scenarios matching what they chose — plain language, no commands, no code blocks. Shape examples:

- "Shipping a bugfix: *Before* — you'd finish the patch, eyeball the diff, push, and hope CI catches anything you missed. *Now* — the stop hook runs a Copilot pass automatically and flags the missing null check before you even type `git push`."
- "Reviewing a teammate's PR locally: *Before* — you'd read the diff and trust your gut. *Now* — you run `/copilot:review --base main` and get a structured second opinion from a different model family in under a minute."

End with: "Want to try it on your current staged changes?" — if yes, run `/copilot:review --scope staged` via the Skill tool.

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
