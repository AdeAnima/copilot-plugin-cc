---
description: Check whether the local Copilot CLI is ready and optionally toggle the stop-time review gate
argument-hint: '[--enable-review-gate|--disable-review-gate]'
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" setup --json $ARGUMENTS
```

If the result says Copilot is unavailable and npm is available:
- Use `AskUserQuestion` exactly once to ask whether Claude should install Copilot CLI now.
- Put the install option first and suffix it with `(Recommended)`.
- Use these two options:
  - `Install Copilot CLI (Recommended)`
  - `Skip for now`
- If the user chooses install, run:

```bash
npm install -g @github/copilot-cli
```

- Then rerun:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" setup --json $ARGUMENTS
```

If Copilot CLI is already installed or npm is unavailable:
- Do not ask about installation.

Output rules:
- Present the final setup output to the user.
- If installation was skipped, present the original setup output.
- If Copilot CLI is installed but not authenticated, preserve the guidance to run `!copilot login`.
- The output includes a review gate status line: `Review gate: [ON/OFF] (enable with /copilot:setup --enable-review-gate)`.

## Offer the guide (optional)

After presenting the setup output, check if this is a fresh install:

- Condition: the setup JSON shows `nextSteps` present AND `reviewGateEnabled === false` AND no `copilot-companion.mjs guide` has been run in this session.
- Action: use `AskUserQuestion` exactly once to offer the guide:
  - Title: "First time using this plugin?"
  - Options:
    - `Yes — run /copilot:guide now (Recommended)`
    - `No — I'll explore on my own`
- If "Yes": invoke the Skill tool with `copilot:guide` (no arguments).
- If "No": end silently.
- If the condition does not match (e.g. returning user, gate already ON, etc.), do NOT show the offer.
