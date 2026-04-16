# Copilot Plugin for Claude Code — Testing Guide

**Version:** 2.0.0-alpha.1
**Last updated:** 2026-04-16
**Repo:** `~/Code/agents/copilot-plugin-cc`

This document is the single source of truth for validating the Copilot plugin. It covers unit tests, integration tests, sub-agent workflow tests, and performance tests. Run the full suite before any release.

---

## Prerequisites

- Node.js >= 18.18 (`node --version`)
- npm (`npm --version`)
- GitHub Copilot CLI >= 1.0.x (`copilot --version`)
- Copilot CLI authenticated (`copilot auth status`)
- `@github/copilot-sdk` installed (`ls node_modules/@github/copilot-sdk`)

## Setup

Start a Claude Code session with the plugin loaded:

```bash
claude --plugin-dir ~/Code/agents/copilot-plugin-cc/plugins
```

Verify with `/copilot:setup` — all checks should pass.

---

## Part 1: Unit Tests

Run automatically, no Copilot CLI needed.

```bash
cd ~/Code/agents/copilot-plugin-cc

# Our 4 test suites (34 tests)
node --test tests/permission-model.test.mjs tests/sdk-stability.test.mjs tests/git-staged.test.mjs tests/structured-review.test.mjs

# Full suite (107 tests, 2 pre-existing failures in runtime.test.mjs expected)
node --test tests/*.test.mjs
```

**Expected:** 105/107 pass. The 2 failures in `runtime.test.mjs` (`buildPersistentTaskSessionId`) are pre-existing from upstream.

### Permission model inline test

```bash
node -e "
const { buildPermissionHandler } = await import('./plugins/copilot/scripts/lib/copilot-client.mjs');
const tests = [
  ['Gate OFF + edit', { gateEnabled: false, interactive: false }, 'edit', 'denied'],
  ['Gate OFF + bash', { gateEnabled: false, interactive: false }, 'bash', 'denied'],
  ['Gate ON + edit', { gateEnabled: true, interactive: false }, 'edit', 'approved'],
  ['Gate ON + bash', { gateEnabled: true, interactive: false }, 'bash', 'approved'],
  ['Gate OFF + view', { gateEnabled: false, interactive: false }, 'view', 'approved'],
  ['Gate OFF + glob', { gateEnabled: false, interactive: false }, 'glob', 'approved'],
  ['Gate OFF + file_write', { gateEnabled: false, interactive: false }, 'file_write', 'denied'],
  ['Gate ON + file_write', { gateEnabled: true, interactive: false }, 'file_write', 'approved'],
];
let pass = 0, fail = 0;
for (const [label, opts, tool, expected] of tests) {
  const h = buildPermissionHandler(opts);
  const r = await h({ tool });
  if (r.kind === expected) { console.log('PASS |', label); pass++; }
  else { console.log('FAIL |', label, '| expected', expected, 'got', r.kind); fail++; }
}
console.log('\nPermission model:', pass, 'pass,', fail, 'fail');
"
```

**Expected:** 8/8 pass.

---

## Part 2: Integration Tests (CLI)

These test the scripts directly via Bash. No Claude Code session needed.

```bash
cd ~/Code/agents/copilot-plugin-cc
```

### 1. Setup & Configuration

| # | Test | Command | Expected |
|---|------|---------|----------|
| 1.1 | Setup check | `node plugins/copilot/scripts/copilot-companion.mjs setup --json` | All green: Node, npm, Copilot CLI, auth, SDK version (0.2.2). Gate: OFF |
| 1.2 | Enable gate | `node plugins/copilot/scripts/copilot-companion.mjs setup --enable-review-gate --json` | `reviewGateEnabled: true` |
| 1.3 | Status shows gate | `node plugins/copilot/scripts/copilot-companion.mjs status` | Shows "Review Gate: ON" |
| 1.4 | Disable gate | `node plugins/copilot/scripts/copilot-companion.mjs setup --disable-review-gate --json` | `reviewGateEnabled: false` |

### 2. Standard Review

| # | Test | Command | Expected |
|---|------|---------|----------|
| 2.1 | Working-tree review | Make a change, run `node .../copilot-companion.mjs review --scope working-tree --wait` | Structured output with severity, file, line, recommendation |
| 2.2 | Staged review | Stage a change, run `node .../copilot-companion.mjs review --scope staged --wait` | Reviews ONLY staged changes |
| 2.3 | Nothing staged | With nothing staged, run `node .../copilot-companion.mjs review --scope staged` | Error: "Nothing staged — stage changes with `git add` first." (exit 1) |
| 2.4 | Branch review | On a branch ahead of main, run `node .../copilot-companion.mjs review --scope branch --wait` | Reviews full branch diff |
| 2.5 | Invalid scope | `node .../copilot-companion.mjs review --scope foobar` | Error: "Unsupported review scope" (exit 1) |
| 2.6 | Non-git directory | `cd /tmp && node ~/Code/agents/.../copilot-companion.mjs review --scope working-tree` | Error: "This command must run inside a Git repository." (exit 1) |

### 3. Adversarial Review

| # | Test | Command | Expected |
|---|------|---------|----------|
| 3.1 | Basic adversarial | Make changes, run `node .../copilot-companion.mjs adversarial-review --wait` | Structured findings with verdict, severity, confidence |
| 3.2 | With focus | `node .../copilot-companion.mjs adversarial-review --wait security` | Review weighted toward security concerns |
| 3.3 | Staged scope | `node .../copilot-companion.mjs adversarial-review --scope staged --wait` | Only reviews staged changes |
| 3.4 | Nothing staged | `node .../copilot-companion.mjs adversarial-review --scope staged` | Error: "Nothing staged" (exit 1) |

### 4. Rescue / Task Delegation

| # | Test | Command | Expected |
|---|------|---------|----------|
| 4.1 | Read-only task | `node .../copilot-companion.mjs task "explain what render.mjs does" --wait` | Copilot explains without editing files |
| 4.2 | Verify no writes | After 4.1, `git status --short` | No new changes |
| 4.3 | Write mode | `node .../copilot-companion.mjs task "add a comment to workspace.mjs" --write --wait` | File edited |
| 4.4 | Background task | `node .../copilot-companion.mjs task "explain git.mjs" --background` | Returns immediately with job ID |
| 4.5 | Check result | After 4.4, `node .../copilot-companion.mjs status` then `node .../copilot-companion.mjs result` | Shows job, then result |

### 5. Job Management

| # | Test | Command | Expected |
|---|------|---------|----------|
| 5.1 | Status | `node .../copilot-companion.mjs status` | Gate state + job tables |
| 5.2 | Result (latest) | `node .../copilot-companion.mjs result` | Most recent completed job |
| 5.3 | Cancel (none active) | `node .../copilot-companion.mjs cancel` | "No active Copilot jobs to cancel" (exit 1) |

### 6. Tool Completion Logging

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 6.1 | Tool names logged | Run a working-tree review, filter output with `grep "Tool "` | Shows "Tool view completed", "Tool report_intent completed" — NOT "Tool unknown completed" |

---

## Part 3: Slash Command Tests (Claude Code Session)

These require an active Claude Code session with the plugin loaded.

### Skill Tool Invocability

| # | Test | Method | Expected |
|---|------|--------|----------|
| S.1 | `/copilot:setup` via Skill | Invoke Skill tool with `copilot:setup` | Returns full setup JSON |
| S.2 | `/copilot:review` via Skill | Invoke Skill tool with `copilot:review` and args `--scope staged --wait` | Review runs and returns findings |
| S.3 | `/copilot:adversarial-review` via Skill | Invoke Skill tool with `copilot:adversarial-review` and args `--scope staged --wait` | Adversarial review runs |
| S.4 | `/copilot:rescue` via Skill | Invoke Skill tool with `copilot:rescue` and args `explain render.mjs` | Rescue sub-agent runs |
| S.5 | `/copilot:status` user-only | Try Skill tool with `copilot:status` | Error: `disable-model-invocation` |
| S.6 | `/copilot:cancel` user-only | Try Skill tool with `copilot:cancel` | Error: `disable-model-invocation` |
| S.7 | `/copilot:result` user-only | Try Skill tool with `copilot:result` | Error: `disable-model-invocation` |

### Sub-Agent Plugin Access

| # | Test | Method | Expected |
|---|------|--------|----------|
| SA.1 | Sub-agent setup | Spawn Agent, have it invoke Skill `copilot:setup` | Returns setup JSON from sub-agent context |
| SA.2 | Sub-agent review | Spawn Agent, have it invoke Skill `copilot:review` with `--scope staged --wait` | Review works from sub-agent |
| SA.3 | Rescue agent | Spawn Agent with `subagent_type: "copilot:copilot-rescue"` | Runs successfully |

---

## Part 4: Diff Size Gating

Tests that large diffs fall back to summary mode instead of blowing up context.

**Thresholds:** 2 files max, 256KB max diff size.

### Small Diff (should inline)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| D.1 | 1-file staged review | Stage a 1-line comment change to one file, run staged review | `inputMode: "inline-diff"`, full diff in prompt |

### Large Diff (should self-collect)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| D.2 | 5+ file staged review | Add comments to 5+ files, stage all, run staged review | `inputMode: "self-collect"`, only stats/file list in prompt, model uses view/grep tools |
| D.3 | Branch with many files | Create temp branch with 5+ file commits, run branch review | Self-collect mode triggers |
| D.4 | Adversarial large diff | Stage 5+ files, run adversarial review | Self-collect with collection guidance in prompt |

### Byte Threshold

| # | Test | Steps | Expected |
|---|------|-------|----------|
| D.5 | Under 256KB | Create a single file with ~250KB of content, stage, review | Inline mode |
| D.6 | Over 256KB | Push file over 256KB, re-stage, review | Self-collect mode |

### Robust File Handling

| # | Test | Steps | Expected |
|---|------|-------|----------|
| D.7 | Broken symlink | Create `ln -s /nonexistent broken-link` in repo, run working-tree review | Output: "(skipped: broken symlink or unreadable file)" — no crash |
| D.8 | Directory as untracked | Create an untracked directory, run working-tree review | Output: "(skipped: directory)" — no crash |

### Cleanup

After all diff tests: `git checkout .`, remove temp files/branches, verify `git status --short` is clean.

---

## Part 5: Sub-Agent Self-Review Workflow

This tests the primary use case: parallel sub-agents that implement features and review their own work using the plugin.

### Setup

Dispatch exactly 3 sub-agents in parallel using the Agent tool with `isolation: "worktree"`. Each gets a distinct implementation task. Each must:

1. Implement the change
2. Stage with `git add`
3. Invoke `/copilot:review` or `/copilot:adversarial-review` via the **Skill tool** (NOT Bash)
4. Report what happened

**All 3 agents must be dispatched in a single message for parallel execution.**

### Agent A: Standard review after implementation

**Task:** In `plugins/copilot/scripts/lib/job-control.mjs`, find the function that resolves a job by ID or reference. Add input validation: if the argument is falsy or not a string, throw a TypeError.

**Review:** Invoke `Skill("copilot:review", "--scope staged --wait")`

### Agent B: Standard review after implementation

**Task:** In `plugins/copilot/scripts/lib/process.mjs`, find the main command execution function. Add a default timeout of 30 seconds if no timeout is specified.

**Review:** Invoke `Skill("copilot:review", "--scope staged --wait")`

### Agent C: Adversarial review after implementation

**Task:** In `plugins/copilot/scripts/lib/state.mjs`, find the config loading function. Add a check that warns via `process.stderr` if the config file is world-readable.

**Review:** Invoke `Skill("copilot:adversarial-review", "--scope staged --wait security permissions")`

### What to Verify

| # | Check | Expected |
|---|-------|----------|
| W.1 | All 3 sub-agents invoked Skill tool | Yes — no fallback to Bash |
| W.2 | Skill tool resolved in worktree isolation | Plugin accessible regardless of working directory |
| W.3 | Reviews scoped to staged changes only | Findings reference only the changed files |
| W.4 | Adversarial review returned verdict | approve / needs-attention with confidence scores |
| W.5 | No resource conflicts | Worktree isolation prevented git conflicts |
| W.6 | Review turnaround time | < 30s good, 30-60s acceptable, > 60s too slow |
| W.7 | Main repo untouched | `git status --short` clean after all agents complete |

---

## Part 6: Review Gate (Stop Hook)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| G.1 | Gate fires on stop | Enable gate, make code changes, let Claude finish a response | Stop hook fires, Copilot reviews changes |
| G.2 | Gate resets per session | Enable gate, exit session, start new session | Gate is OFF in new session |

**Note:** G.1 requires a live interactive Claude Code session. It cannot be tested via CLI.

---

## Feedback Format

### For each test:
```
PASS | <test-id> | <one-line description>
```
```
FAIL | <test-id> | <one-line description>
  Expected: <what should have happened>
  Actual: <what actually happened>
  Output: <relevant output, max 3 lines>
  File: <file:line if applicable>
  Repro: <exact command>
```

### For new issues:
```
ISSUE | <critical/high/medium/low> | <title>
  Description: ...
  Steps: ...
  Expected: ...
  Actual: ...
  File: <file:line>
```

### For suggestions:
```
SUGGESTION | <title>
  Description: ...
  Rationale: ...
```

---

## Report Template

```
# Copilot Plugin — Test Report

**Date:** YYYY-MM-DD
**Version:** 2.0.0-alpha.1
**Copilot CLI:** <version>
**SDK:** <version>
**Node:** <version>
**Platform:** <os>

## Unit Tests
- Permission model: N/N pass
- SDK stability: N/N pass
- Git staged: N/N pass
- Structured review: N/N pass
- Full suite: N/107 pass, N fail

## Integration Tests (CLI)

PASS | 1.1 | ...
...

## Slash Command Tests

PASS | S.1 | ...
...

## Sub-Agent Tests

PASS | SA.1 | ...
...

## Diff Size Gating

PASS | D.1 | ...
...

## Sub-Agent Self-Review Workflow

PASS | W.1 | ...
...

## Review Gate

PASS | G.1 | ...
...

## Summary
- Tests run: <N>
- Pass: <N>
- Fail: <N>
- Issues: <N> (N critical, N high, N medium, N low)
- Overall: READY / NEEDS FIXES / BLOCKED

## Performance

| Operation | Avg Duration | Notes |
|-----------|-------------|-------|
| Setup check | <X>s | |
| Staged review (small) | <X>s | inline mode |
| Staged review (large) | <X>s | self-collect mode |
| Working-tree review | <X>s | |
| Branch review | <X>s | |
| Adversarial review | <X>s | |
| Rescue (read-only) | <X>s | |
| Sub-agent Skill invocation | <X>s | |
```

---

## Known Issues (Current)

| Issue | Severity | Status | Description |
|-------|----------|--------|-------------|
| Result retrieval race | Low | Open | `result <job-id>` may return "No job found" immediately after completion. Retry succeeds. |
| Streaming log spam | Low | Open | `[copilot] Streaming response...` repeated 100+ times in --wait output |
| runtime.test.mjs failures | Low | Pre-existing | 2 tests fail in `buildPersistentTaskSessionId` — inherited from upstream |

## Previously Fixed Issues

| Issue | Severity | Fixed In | What Changed |
|-------|----------|----------|-------------|
| WRITE_TOOLS mismatch | Critical | alpha.1 | Added `edit`, `bash` to WRITE_TOOLS set |
| Tool unknown completed | Low | alpha.1 | Track toolCallId from start → complete events |
| JSON code fence parsing | Medium | alpha.1 | `stripCodeFences()` in `parseStructuredOutput` |
| SDK version not shown | Low | alpha.1 | Read from `node_modules/.../package.json` |
| next_steps required | Low | alpha.1 | Made optional in schema + validation |
| disable-model-invocation on reviews | Medium | alpha.1 | Removed — sub-agents can now use Skill tool |
| formatUntrackedFile crash | High | alpha.1 | Handle broken symlinks, directories gracefully |

---

## CLI Quick Reference

```bash
# Direct script execution (no Claude Code session needed):
cd ~/Code/agents/copilot-plugin-cc
node plugins/copilot/scripts/copilot-companion.mjs setup --json
node plugins/copilot/scripts/copilot-companion.mjs review --scope staged --wait
node plugins/copilot/scripts/copilot-companion.mjs review --scope working-tree --wait
node plugins/copilot/scripts/copilot-companion.mjs review --scope branch --wait
node plugins/copilot/scripts/copilot-companion.mjs adversarial-review --wait
node plugins/copilot/scripts/copilot-companion.mjs adversarial-review --scope staged --wait security
node plugins/copilot/scripts/copilot-companion.mjs task "explain this codebase" --wait
node plugins/copilot/scripts/copilot-companion.mjs task "fix a typo" --write --wait
node plugins/copilot/scripts/copilot-companion.mjs status
node plugins/copilot/scripts/copilot-companion.mjs result
node plugins/copilot/scripts/copilot-companion.mjs cancel
node plugins/copilot/scripts/copilot-companion.mjs setup --enable-review-gate --json
node plugins/copilot/scripts/copilot-companion.mjs setup --disable-review-gate --json

# Inside Claude Code session:
/copilot:setup
/copilot:review
/copilot:review --scope staged
/copilot:review --scope branch
/copilot:adversarial-review
/copilot:adversarial-review --scope staged security
/copilot:rescue explain the codebase
/copilot:rescue --write fix the failing test
/copilot:rescue --background investigate the regression
/copilot:status
/copilot:result
/copilot:cancel
```
