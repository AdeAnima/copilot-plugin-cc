# Copilot Plugin for Claude Code — Testing Briefing

**Purpose:** Validate the forked `copilot-plugin-cc` plugin (v2.0.0) works correctly in real Claude Code sessions before publishing.

**Plugin location:** `~/Code/agents/copilot-plugin-cc`
**Spec:** `~/docs/superpowers/specs/2026-04-15-copilot-plugin-cc-fork-design.md`
**Plan:** `~/docs/superpowers/plans/2026-04-15-copilot-plugin-cc-fork.md`

---

## Setup

Start a Claude Code session with the plugin loaded:

```bash
claude --plugin-dir ~/Code/agents/copilot-plugin-cc/plugins/copilot
```

Verify the plugin loaded by running:
```
/copilot:setup
```

Expected: all checks pass (Node, npm, Copilot CLI, auth, SDK), review gate shows OFF.

**Prerequisite:** GitHub Copilot CLI must be installed and authenticated (`copilot --version` should return a version).

---

## Test Matrix

Test each scenario below. For tests that need code changes, use any git repo with uncommitted work (the plugin repo itself works fine).

### 1. Setup & Configuration

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1.1 | Setup check | Run `/copilot:setup` | All green: Node, npm, Copilot CLI, auth, SDK detected. Gate: OFF |
| 1.2 | Enable review gate | Run `/copilot:setup --enable-review-gate` | `reviewGateEnabled: true`, gate shows ON |
| 1.3 | Status shows gate | Run `/copilot:status` | Shows `**Review Gate:** ON` |
| 1.4 | Disable review gate | Run `/copilot:setup --disable-review-gate` | Gate back to OFF |

### 2. Standard Review (`/copilot:review`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.1 | Working-tree review | Make an unstaged change, run `/copilot:review` | Structured output with summary, findings (severity/file/line/recommendation) |
| 2.2 | Staged review | Stage a change (`git add`), run `/copilot:review --scope staged` | Reviews ONLY staged changes, not unstaged |
| 2.3 | Nothing staged error | With nothing staged, run `/copilot:review --scope staged` | Error: "Nothing staged" |
| 2.4 | Branch review | On a branch with commits ahead of main, run `/copilot:review --scope branch` | Reviews full branch diff |
| 2.5 | Structured output | Check that review output has structured format | Findings have severity, title, file, line numbers, recommendation |
| 2.6 | Fallback output | If Copilot returns plain text (unlikely), verify it still renders | Raw text displayed instead of crash |

### 3. Adversarial Review (`/copilot:adversarial-review`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 3.1 | Basic adversarial | Make changes, run `/copilot:adversarial-review` | Structured findings with severity, confidence scores, attack-surface focus |
| 3.2 | With focus text | Run `/copilot:adversarial-review security` | Review focuses on security concerns |
| 3.3 | Staged scope | Run `/copilot:adversarial-review --scope staged` | Only reviews staged changes |

### 4. Rescue / Task Delegation (`/copilot:rescue`)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.1 | Read-only default | Run `/copilot:rescue explain what the render.mjs file does` | Copilot reads and explains but does NOT edit any files |
| 4.2 | Verify no writes | After 4.1, run `git status` | No new changes introduced by Copilot |
| 4.3 | Write mode | Run `/copilot:rescue --write add a comment to workspace.mjs` | Copilot edits the file (only with `--write` flag) |
| 4.4 | Background task | Run `/copilot:rescue --background investigate the test suite` | Returns immediately with job ID |
| 4.5 | Check background result | After 4.4, run `/copilot:status` then `/copilot:result <job-id>` | Shows job status, then full result |

### 5. Job Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 5.1 | Status with no jobs | Fresh session, run `/copilot:status` | Shows gate state, no jobs or empty list |
| 5.2 | Status after review | Run a review, then `/copilot:status` | Shows completed review job with summary |
| 5.3 | Result retrieval | Run `/copilot:result` (no args) | Shows most recent job result |
| 5.4 | Cancel active job | Start a background task, immediately run `/copilot:cancel` | Job cancelled |

### 6. Permission Model

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 6.1 | Gate OFF + rescue write | With gate OFF, run `/copilot:rescue --write fix a typo` | Should prompt or deny write permission (non-interactive context = denied) |
| 6.2 | Gate ON + rescue write | Enable gate, run `/copilot:rescue --write fix a typo` | Writes auto-approved (gate is safety net) |
| 6.3 | Reviews always safe | With gate OFF, run `/copilot:review` | Works fine (reviews are read-only, always approved) |

### 7. Review Gate (Stop Hook)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 7.1 | Gate fires on stop | Enable gate, make code changes, let Claude finish a response | Stop hook fires, Copilot reviews the changes |
| 7.2 | Gate session reset | Enable gate, exit session, start new session | Gate should be OFF in new session |

### 8. Error Handling

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 8.1 | Invalid scope | Run `/copilot:review --scope foobar` | Clear error: "Unsupported review scope" |
| 8.2 | No git repo | Run from a non-git directory | Clear error about git repository |
| 8.3 | SDK version info | Run `/copilot:setup` | Shows pinned SDK version (0.2.2) |

---

## What To Look For Beyond the Matrix

- **Performance:** How long do reviews take? Note if any command takes >60 seconds.
- **Output quality:** Is the structured review output useful? Are findings actionable?
- **Edge cases:** Large diffs, binary files, repos with no remote, detached HEAD state.
- **Stability:** Does the SDK connection stay stable across multiple commands in one session?
- **Resource usage:** Does the Copilot CLI process clean up after commands finish?

---

## Feedback Format

Report findings using this exact format so they can be parsed and acted on efficiently:

### For passing tests:
```
PASS | <test-id> | <brief note if anything noteworthy>
```

### For failing tests:
```
FAIL | <test-id> | <what happened>
  Expected: <what should have happened>
  Actual: <what actually happened>
  Error: <error message or output, verbatim>
  File: <file path if relevant>
  Repro: <exact commands to reproduce>
```

### For new issues discovered:
```
ISSUE | <severity: critical/high/medium/low> | <short title>
  Description: <what's wrong>
  Steps: <how to reproduce>
  Expected: <correct behavior>
  Actual: <what happens instead>
  Output: <relevant output, verbatim>
  File: <file path if relevant, with line number>
```

### For suggestions:
```
SUGGESTION | <short title>
  Description: <what could be improved>
  Rationale: <why it matters>
```

### Example feedback report:
```
PASS | 1.1 |
PASS | 1.2 |
PASS | 1.3 |
FAIL | 2.3 | Nothing-staged error doesn't fire
  Expected: Error message "Nothing staged — stage changes with `git add` first."
  Actual: Empty review returned with no findings
  Error: (no error thrown, silent empty result)
  Repro: `cd /tmp/test-repo && git init && git commit --allow-empty -m init && node ~/Code/agents/copilot-plugin-cc/plugins/copilot/scripts/copilot-companion.mjs review --scope staged --wait`

ISSUE | medium | Status output truncates long summaries
  Description: Job summaries over 120 chars are cut off in status output without ellipsis
  Steps: Run a review on a large diff, then /copilot:status
  Expected: Summary truncated with "..."
  Actual: Summary cut off mid-word
  Output: "Reviewing changes to the authentication middleware that handles sess"
  File: plugins/copilot/scripts/lib/render.mjs:245

SUGGESTION | Add --json flag to review output
  Description: Allow /copilot:review --json to return raw structured JSON instead of rendered markdown
  Rationale: Useful for piping review output into other tools or scripts
```

### Summary section:
End the report with a summary:
```
## Summary
- Tests run: <N>
- Pass: <N>
- Fail: <N>
- Issues found: <N>
- Suggestions: <N>
- Overall: READY / NEEDS FIXES / BLOCKED
```

---

## Commands Reference (Quick)

```bash
# Direct CLI (for testing outside Claude Code sessions):
cd ~/Code/agents/copilot-plugin-cc
node plugins/copilot/scripts/copilot-companion.mjs setup --json
node plugins/copilot/scripts/copilot-companion.mjs review --scope staged --wait
node plugins/copilot/scripts/copilot-companion.mjs review --scope working-tree --wait
node plugins/copilot/scripts/copilot-companion.mjs review --scope branch --wait
node plugins/copilot/scripts/copilot-companion.mjs adversarial-review --wait
node plugins/copilot/scripts/copilot-companion.mjs task "explain this codebase" --wait
node plugins/copilot/scripts/copilot-companion.mjs task "fix the bug" --write --wait
node plugins/copilot/scripts/copilot-companion.mjs status
node plugins/copilot/scripts/copilot-companion.mjs result
node plugins/copilot/scripts/copilot-companion.mjs cancel
node plugins/copilot/scripts/copilot-companion.mjs setup --enable-review-gate --json
node plugins/copilot/scripts/copilot-companion.mjs setup --disable-review-gate --json

# Inside Claude Code session (with --plugin-dir loaded):
/copilot:setup
/copilot:review
/copilot:review --scope staged
/copilot:adversarial-review
/copilot:rescue explain the codebase
/copilot:status
/copilot:result
/copilot:cancel
```
