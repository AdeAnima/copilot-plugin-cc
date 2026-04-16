# /copilot:guide Command — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/copilot:guide` slash command that onboards new users, migrates Codex users, or audits existing power users — routing based on silently-detected signals.

**Architecture:** Detection-only script (`guide-profile.mjs`) builds a JSON profile of the user's environment. The command file (`commands/guide.md`) consumes that profile and drives an interactive conversation using AskUserQuestion, dry-runs each proposed change, and applies only approved changes. Setup command optionally offers to launch the guide after readiness checks pass.

**Tech Stack:** Node.js 18+ ESM, Node test runner (`node --test`), existing plugin libs (git.mjs, state.mjs, job-control.mjs).

---

## File Structure

**New files:**
- `plugins/copilot/scripts/lib/guide-profile.mjs` — detection logic, mode routing, structured profile builder
- `plugins/copilot/commands/guide.md` — slash command (prompt that drives the conversation)
- `tests/guide-profile.test.mjs` — unit tests for the profile builder

**Modified files:**
- `plugins/copilot/scripts/copilot-companion.mjs` — add `guide` subcommand
- `plugins/copilot/commands/setup.md` — offer to launch guide after readiness check
- `plugins/copilot/scripts/lib/git.mjs` — expose `sampleRecentCommits(n)` helper
- `plugins/copilot/scripts/lib/job-control.mjs` — expose `listJobsSummary(workspaceRoot, sinceMs)` aggregator
- `docs/testing-guide.md` — add guide command tests

---

## Task 1: guide-profile.mjs skeleton + mode routing logic

**Files:**
- Create: `plugins/copilot/scripts/lib/guide-profile.mjs`
- Test: `tests/guide-profile.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// tests/guide-profile.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveMode } from "../plugins/copilot/scripts/lib/guide-profile.mjs";

describe("resolveMode", () => {
  it("returns migration when codex plugin detected", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: true },
      pluginState: { jobsRun: 0, reviewGateEnabled: false },
      claudeConfig: { mentionsCopilot: false }
    });
    assert.equal(mode, "migration");
  });

  it("returns audit when gate is enabled", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: false },
      pluginState: { jobsRun: 0, reviewGateEnabled: true },
      claudeConfig: { mentionsCopilot: false }
    });
    assert.equal(mode, "audit");
  });

  it("returns audit when jobsRun > 5", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: false },
      pluginState: { jobsRun: 10, reviewGateEnabled: false },
      claudeConfig: { mentionsCopilot: false }
    });
    assert.equal(mode, "audit");
  });

  it("returns audit when CLAUDE.md mentions Copilot", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: false },
      pluginState: { jobsRun: 0, reviewGateEnabled: false },
      claudeConfig: { mentionsCopilot: true }
    });
    assert.equal(mode, "audit");
  });

  it("returns onboarding for fresh install", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: false },
      pluginState: { jobsRun: 0, reviewGateEnabled: false },
      claudeConfig: { mentionsCopilot: false }
    });
    assert.equal(mode, "onboarding");
  });

  it("migration takes priority over audit signals", () => {
    const mode = resolveMode({
      otherPlugins: { codexPluginDetected: true },
      pluginState: { jobsRun: 100, reviewGateEnabled: true },
      claudeConfig: { mentionsCopilot: true }
    });
    assert.equal(mode, "migration");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/marten/Code/agents/copilot-plugin-cc && node --test tests/guide-profile.test.mjs`
Expected: FAIL with "Cannot find module .../guide-profile.mjs"

- [ ] **Step 3: Create guide-profile.mjs with minimal resolveMode**

```js
// plugins/copilot/scripts/lib/guide-profile.mjs

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/guide-profile.test.mjs`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add plugins/copilot/scripts/lib/guide-profile.mjs tests/guide-profile.test.mjs
git commit -m "feat(guide): add mode routing logic for /copilot:guide command"
```

---

## Task 2: Size tier calculator

**Files:**
- Modify: `plugins/copilot/scripts/lib/guide-profile.mjs`
- Modify: `tests/guide-profile.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tests/guide-profile.test.mjs`:

```js
import { computeSizeTier } from "../plugins/copilot/scripts/lib/guide-profile.mjs";

describe("computeSizeTier", () => {
  it("tiny < 50", () => { assert.equal(computeSizeTier(0), "tiny"); });
  it("tiny at 49", () => { assert.equal(computeSizeTier(49), "tiny"); });
  it("small at 50", () => { assert.equal(computeSizeTier(50), "small"); });
  it("small at 499", () => { assert.equal(computeSizeTier(499), "small"); });
  it("medium at 500", () => { assert.equal(computeSizeTier(500), "medium"); });
  it("medium at 4999", () => { assert.equal(computeSizeTier(4999), "medium"); });
  it("large at 5000", () => { assert.equal(computeSizeTier(5000), "large"); });
  it("large at 49999", () => { assert.equal(computeSizeTier(49999), "large"); });
  it("huge at 50000", () => { assert.equal(computeSizeTier(50000), "huge"); });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/guide-profile.test.mjs`
Expected: FAIL with "computeSizeTier is not a function"

- [ ] **Step 3: Implement computeSizeTier**

Append to `plugins/copilot/scripts/lib/guide-profile.mjs`:

```js
export function computeSizeTier(fileCount) {
  if (fileCount >= 50000) return "huge";
  if (fileCount >= 5000) return "large";
  if (fileCount >= 500) return "medium";
  if (fileCount >= 50) return "small";
  return "tiny";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/guide-profile.test.mjs`
Expected: PASS, 15 tests total

- [ ] **Step 5: Commit**

```bash
git add plugins/copilot/scripts/lib/guide-profile.mjs tests/guide-profile.test.mjs
git commit -m "feat(guide): add repo size tier calculator"
```

---

## Task 3: Expose sampleRecentCommits helper in git.mjs

**Files:**
- Modify: `plugins/copilot/scripts/lib/git.mjs`
- Test: `tests/git-sample-commits.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/git-sample-commits.test.mjs`:

```js
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { sampleRecentCommits } from "../plugins/copilot/scripts/lib/git.mjs";

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guide-sample-"));
  execSync("git init -q", { cwd: dir });
  execSync('git config user.email "t@t.io"', { cwd: dir });
  execSync('git config user.name "Test"', { cwd: dir });
  return dir;
}

function commit(dir, files, msg) {
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  execSync("git add -A", { cwd: dir });
  execSync(`git commit -q -m "${msg}"`, { cwd: dir });
}

describe("sampleRecentCommits", () => {
  let dir;
  beforeEach(() => { dir = makeRepo(); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("returns empty summary when repo has no commits", () => {
    const result = sampleRecentCommits(dir, 20);
    assert.equal(result.count, 0);
    assert.equal(result.changesetMedianFiles, 0);
    assert.equal(result.changesetMedianLines, 0);
  });

  it("computes median and p95 across commits", () => {
    commit(dir, { "a.txt": "1\n" }, "first");
    commit(dir, { "b.txt": "2\n2\n2\n" }, "second");
    commit(dir, { "c.txt": "3\n3\n" }, "third");
    const result = sampleRecentCommits(dir, 20);
    assert.equal(result.count, 3);
    assert.ok(result.changesetMedianFiles >= 1);
    assert.ok(result.changesetMedianLines >= 1);
    assert.ok(result.changesetP95Files >= result.changesetMedianFiles);
    assert.ok(result.changesetP95Lines >= result.changesetMedianLines);
  });

  it("respects the n limit", () => {
    for (let i = 0; i < 5; i++) commit(dir, { [`f${i}.txt`]: "x\n" }, `c${i}`);
    const result = sampleRecentCommits(dir, 3);
    assert.equal(result.count, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/git-sample-commits.test.mjs`
Expected: FAIL with "sampleRecentCommits is not a function"

- [ ] **Step 3: Implement sampleRecentCommits**

Add to `plugins/copilot/scripts/lib/git.mjs` (append before the final `export function collectReviewContext`):

```js
function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length));
  return sortedValues[idx];
}

function median(sortedValues) {
  if (sortedValues.length === 0) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    return Math.floor((sortedValues[mid - 1] + sortedValues[mid]) / 2);
  }
  return sortedValues[mid];
}

export function sampleRecentCommits(cwd, n) {
  const limit = Math.max(1, Math.floor(Number(n) || 20));
  const log = git(cwd, ["log", `-n${limit}`, "--format=%H"]);
  if (log.status !== 0) {
    return { count: 0, changesetMedianFiles: 0, changesetMedianLines: 0, changesetP95Files: 0, changesetP95Lines: 0 };
  }
  const shas = log.stdout.trim().split("\n").filter(Boolean);
  const fileCounts = [];
  const lineCounts = [];
  for (const sha of shas) {
    const stat = git(cwd, ["show", "--stat", "--format=", sha]);
    if (stat.status !== 0) continue;
    const lines = stat.stdout.trim().split("\n").filter(Boolean);
    const summary = lines[lines.length - 1] || "";
    const filesMatch = summary.match(/(\d+) files? changed/);
    const insMatch = summary.match(/(\d+) insertion/);
    const delMatch = summary.match(/(\d+) deletion/);
    fileCounts.push(filesMatch ? Number(filesMatch[1]) : 0);
    lineCounts.push((insMatch ? Number(insMatch[1]) : 0) + (delMatch ? Number(delMatch[1]) : 0));
  }
  const sortedFiles = [...fileCounts].sort((a, b) => a - b);
  const sortedLines = [...lineCounts].sort((a, b) => a - b);
  return {
    count: shas.length,
    changesetMedianFiles: median(sortedFiles),
    changesetMedianLines: median(sortedLines),
    changesetP95Files: percentile(sortedFiles, 95),
    changesetP95Lines: percentile(sortedLines, 95)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/git-sample-commits.test.mjs`
Expected: PASS, 3 tests

- [ ] **Step 5: Verify no regression on existing git tests**

Run: `node --test tests/git.test.mjs tests/git-staged.test.mjs`
Expected: PASS (14 tests)

- [ ] **Step 6: Commit**

```bash
git add plugins/copilot/scripts/lib/git.mjs tests/git-sample-commits.test.mjs
git commit -m "feat(git): add sampleRecentCommits for data-driven threshold tuning"
```

---

## Task 4: CLAUDE.md detection (exists, writable, managed marker, mentions)

**Files:**
- Modify: `plugins/copilot/scripts/lib/guide-profile.mjs`
- Modify: `tests/guide-profile.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tests/guide-profile.test.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { detectClaudeConfig } from "../plugins/copilot/scripts/lib/guide-profile.mjs";

describe("detectClaudeConfig", () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "guide-claude-")); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("returns claudeMdExists=false when missing", () => {
    const c = detectClaudeConfig(dir);
    assert.equal(c.claudeMdExists, false);
    assert.equal(c.claudeMdWritable, false);
    assert.equal(c.mentionsCopilot, false);
  });

  it("detects plain CLAUDE.md", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Project\nUse Bun.\n");
    const c = detectClaudeConfig(dir);
    assert.equal(c.claudeMdExists, true);
    assert.equal(c.claudeMdWritable, true);
    assert.equal(c.mentionsCopilot, false);
    assert.equal(c.mentionsSubagents, false);
    assert.equal(c.mentionsWorktrees, false);
    assert.equal(c.claudeMdHasManagedMarker, false);
  });

  it("detects Copilot mention", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Project\nRun /copilot:review.\n");
    const c = detectClaudeConfig(dir);
    assert.equal(c.mentionsCopilot, true);
  });

  it("detects sub-agent and worktree mentions", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "Dispatch sub-agent via worktree.\n");
    const c = detectClaudeConfig(dir);
    assert.equal(c.mentionsSubagents, true);
    assert.equal(c.mentionsWorktrees, true);
  });

  it("detects managed marker", () => {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Managed by platform team\nDO NOT EDIT\n");
    const c = detectClaudeConfig(dir);
    assert.equal(c.claudeMdHasManagedMarker, true);
  });

  it("detects read-only file", () => {
    const p = path.join(dir, "CLAUDE.md");
    fs.writeFileSync(p, "content\n");
    fs.chmodSync(p, 0o444);
    const c = detectClaudeConfig(dir);
    assert.equal(c.claudeMdWritable, false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/guide-profile.test.mjs`
Expected: FAIL with "detectClaudeConfig is not a function"

- [ ] **Step 3: Implement detectClaudeConfig**

Append to `plugins/copilot/scripts/lib/guide-profile.mjs`:

```js
import fs from "node:fs";
import path from "node:path";

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/guide-profile.test.mjs`
Expected: PASS, 21 tests total

- [ ] **Step 5: Commit**

```bash
git add plugins/copilot/scripts/lib/guide-profile.mjs tests/guide-profile.test.mjs
git commit -m "feat(guide): detect CLAUDE.md state, writability, and mentions"
```

---

## Task 5: Hooks + CI detection

**Files:**
- Modify: `plugins/copilot/scripts/lib/guide-profile.mjs`
- Modify: `tests/guide-profile.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tests/guide-profile.test.mjs`:

```js
import { detectHooks, detectCiConfig } from "../plugins/copilot/scripts/lib/guide-profile.mjs";

describe("detectHooks", () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "guide-hooks-"));
    execSync("git init -q", { cwd: dir });
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("reports no hooks when absent", () => {
    const h = detectHooks(dir);
    assert.equal(h.preCommit.present, false);
  });

  it("detects husky pre-commit", () => {
    fs.mkdirSync(path.join(dir, ".husky"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".husky", "pre-commit"), "#!/bin/sh\n");
    const h = detectHooks(dir);
    assert.equal(h.preCommit.present, true);
    assert.equal(h.preCommit.type, "husky");
  });

  it("detects pre-commit framework", () => {
    fs.writeFileSync(path.join(dir, ".pre-commit-config.yaml"), "repos: []\n");
    const h = detectHooks(dir);
    assert.equal(h.preCommit.present, true);
    assert.equal(h.preCommit.type, "pre-commit");
  });

  it("detects lefthook", () => {
    fs.writeFileSync(path.join(dir, "lefthook.yml"), "pre-commit:\n");
    const h = detectHooks(dir);
    assert.equal(h.preCommit.present, true);
    assert.equal(h.preCommit.type, "lefthook");
  });

  it("detects raw git pre-commit hook", () => {
    fs.writeFileSync(path.join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\n");
    const h = detectHooks(dir);
    assert.equal(h.preCommit.present, true);
    assert.equal(h.preCommit.type, "git");
  });
});

describe("detectCiConfig", () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "guide-ci-")); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("reports none when absent", () => {
    const ci = detectCiConfig(dir);
    assert.equal(ci.githubActions, false);
    assert.deepEqual(ci.detectedWorkflows, []);
  });

  it("detects GitHub Actions workflow files", () => {
    const wf = path.join(dir, ".github", "workflows");
    fs.mkdirSync(wf, { recursive: true });
    fs.writeFileSync(path.join(wf, "ci.yml"), "name: ci\n");
    fs.writeFileSync(path.join(wf, "release.yml"), "name: release\n");
    const ci = detectCiConfig(dir);
    assert.equal(ci.githubActions, true);
    assert.equal(ci.detectedWorkflows.length, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/guide-profile.test.mjs`
Expected: FAIL with "detectHooks is not a function"

- [ ] **Step 3: Implement detectHooks + detectCiConfig**

Append to `plugins/copilot/scripts/lib/guide-profile.mjs`:

```js
export function detectHooks(cwd) {
  const candidates = [
    { type: "husky", rel: ".husky/pre-commit" },
    { type: "pre-commit", rel: ".pre-commit-config.yaml" },
    { type: "lefthook", rel: "lefthook.yml" },
    { type: "lefthook", rel: "lefthook.yaml" },
    { type: "git", rel: ".git/hooks/pre-commit" }
  ];
  let preCommit = { present: false };
  for (const cand of candidates) {
    const p = path.join(cwd, cand.rel);
    if (fs.existsSync(p)) {
      preCommit = { present: true, type: cand.type, path: p };
      break;
    }
  }
  const stopHookPath = path.join(cwd, ".claude", "hooks", "stop.json");
  const sessionHookPath = path.join(cwd, ".claude", "hooks", "session-start.json");
  return {
    preCommit,
    stopHook: { present: fs.existsSync(stopHookPath) },
    sessionStartHook: { present: fs.existsSync(sessionHookPath) }
  };
}

export function detectCiConfig(cwd) {
  const wfDir = path.join(cwd, ".github", "workflows");
  if (!fs.existsSync(wfDir)) return { githubActions: false, detectedWorkflows: [] };
  let files = [];
  try {
    files = fs.readdirSync(wfDir)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .map((f) => path.join(".github", "workflows", f));
  } catch {
    files = [];
  }
  return { githubActions: files.length > 0, detectedWorkflows: files };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/guide-profile.test.mjs`
Expected: PASS, 28 tests total

- [ ] **Step 5: Commit**

```bash
git add plugins/copilot/scripts/lib/guide-profile.mjs tests/guide-profile.test.mjs
git commit -m "feat(guide): detect pre-commit hooks and CI workflow config"
```

---

## Task 6: Plugin state + Codex plugin detection

**Files:**
- Modify: `plugins/copilot/scripts/lib/guide-profile.mjs`
- Modify: `plugins/copilot/scripts/lib/job-control.mjs`
- Modify: `tests/guide-profile.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `tests/guide-profile.test.mjs`:

```js
import { detectPluginState, detectOtherPlugins } from "../plugins/copilot/scripts/lib/guide-profile.mjs";

describe("detectPluginState", () => {
  it("returns zero-state for a fresh workspace", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guide-plugin-"));
    try {
      const s = detectPluginState(dir);
      assert.equal(s.reviewGateEnabled, false);
      assert.equal(s.jobsRun, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("detectOtherPlugins", () => {
  it("returns codexPluginDetected=false when codex dir absent", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "guide-home-"));
    try {
      const p = detectOtherPlugins({ home });
      assert.equal(p.codexPluginDetected, false);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it("detects codex plugin directory", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "guide-home-"));
    try {
      fs.mkdirSync(path.join(home, ".claude", "plugins", "codex-plugin-cc"), { recursive: true });
      const p = detectOtherPlugins({ home });
      assert.equal(p.codexPluginDetected, true);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/guide-profile.test.mjs`
Expected: FAIL with "detectPluginState is not a function"

- [ ] **Step 3: Implement detectPluginState + detectOtherPlugins**

Append to `plugins/copilot/scripts/lib/guide-profile.mjs`:

```js
import { getConfig, listJobs } from "./state.mjs";

export function detectPluginState(workspaceRoot) {
  let reviewGateEnabled = false;
  let jobsRun = 0;
  try {
    reviewGateEnabled = Boolean(getConfig(workspaceRoot, "stopReviewGate"));
  } catch {
    reviewGateEnabled = false;
  }
  try {
    jobsRun = listJobs(workspaceRoot).length;
  } catch {
    jobsRun = 0;
  }
  return { reviewGateEnabled, jobsRun };
}

export function detectOtherPlugins(options = {}) {
  const home = options.home ?? process.env.HOME ?? "";
  const codexDir = path.join(home, ".claude", "plugins", "codex-plugin-cc");
  return {
    codexPluginDetected: fs.existsSync(codexDir)
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/guide-profile.test.mjs`
Expected: PASS, 31 tests total

- [ ] **Step 5: Commit**

```bash
git add plugins/copilot/scripts/lib/guide-profile.mjs tests/guide-profile.test.mjs
git commit -m "feat(guide): detect plugin state and Codex plugin presence"
```

---

## Task 7: Assemble full profile builder

**Files:**
- Modify: `plugins/copilot/scripts/lib/guide-profile.mjs`
- Modify: `tests/guide-profile.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to `tests/guide-profile.test.mjs`:

```js
import { buildGuideProfile } from "../plugins/copilot/scripts/lib/guide-profile.mjs";

describe("buildGuideProfile", () => {
  let dir;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "guide-profile-"));
    execSync("git init -q", { cwd: dir });
    execSync('git config user.email "t@t.io"', { cwd: dir });
    execSync('git config user.name "T"', { cwd: dir });
    fs.writeFileSync(path.join(dir, "a.txt"), "x\n");
    execSync("git add -A && git commit -q -m init", { cwd: dir });
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it("returns structured profile with recommendedMode", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "guide-home-"));
    try {
      const profile = buildGuideProfile({ cwd: dir, workspaceRoot: dir, home });
      assert.ok(profile.environment);
      assert.ok(profile.repo);
      assert.equal(profile.repo.isGitRepo, true);
      assert.ok(typeof profile.repo.fileCount === "number");
      assert.ok(typeof profile.repo.sizeTier === "string");
      assert.ok(profile.claudeConfig);
      assert.ok(profile.hooks);
      assert.ok(profile.ciConfig);
      assert.ok(profile.pluginState);
      assert.ok(profile.otherPlugins);
      assert.equal(profile.recommendedMode, "onboarding");
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it("sets recommendedMode=migration when codex plugin present", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "guide-home-"));
    try {
      fs.mkdirSync(path.join(home, ".claude", "plugins", "codex-plugin-cc"), { recursive: true });
      const profile = buildGuideProfile({ cwd: dir, workspaceRoot: dir, home });
      assert.equal(profile.recommendedMode, "migration");
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/guide-profile.test.mjs`
Expected: FAIL with "buildGuideProfile is not a function"

- [ ] **Step 3: Implement buildGuideProfile**

Append to `plugins/copilot/scripts/lib/guide-profile.mjs`:

```js
import { execSync } from "node:child_process";
import { ensureGitRepository, detectDefaultBranch, sampleRecentCommits } from "./git.mjs";

function countRepoFiles(cwd) {
  try {
    const out = execSync("git ls-files | wc -l", { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString();
    return Number(out.trim()) || 0;
  } catch {
    return 0;
  }
}

export function buildGuideProfile(opts = {}) {
  const cwd = opts.cwd ?? process.cwd();
  const workspaceRoot = opts.workspaceRoot ?? cwd;
  const home = opts.home ?? process.env.HOME ?? "";

  let isGitRepo = true;
  try { ensureGitRepository(cwd); } catch { isGitRepo = false; }

  const fileCount = isGitRepo ? countRepoFiles(cwd) : 0;
  let defaultBranch = null;
  try { defaultBranch = isGitRepo ? detectDefaultBranch(cwd) : null; } catch { defaultBranch = null; }
  const recentCommits = isGitRepo ? sampleRecentCommits(cwd, 20) : { count: 0, changesetMedianFiles: 0, changesetMedianLines: 0, changesetP95Files: 0, changesetP95Lines: 0 };

  const profile = {
    environment: {
      node: process.version,
      platform: process.platform
    },
    repo: {
      isGitRepo,
      fileCount,
      sizeTier: computeSizeTier(fileCount),
      defaultBranch,
      recentCommits
    },
    claudeConfig: detectClaudeConfig(cwd),
    hooks: detectHooks(cwd),
    ciConfig: detectCiConfig(cwd),
    pluginState: detectPluginState(workspaceRoot),
    otherPlugins: detectOtherPlugins({ home })
  };

  profile.recommendedMode = resolveMode(profile);
  return profile;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/guide-profile.test.mjs`
Expected: PASS, 33 tests total

- [ ] **Step 5: Commit**

```bash
git add plugins/copilot/scripts/lib/guide-profile.mjs tests/guide-profile.test.mjs
git commit -m "feat(guide): assemble full profile builder with mode routing"
```

---

## Task 8: Expose listJobsSummary in job-control.mjs

**Files:**
- Modify: `plugins/copilot/scripts/lib/job-control.mjs`
- Test: `tests/job-summary.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/job-summary.test.mjs`:

```js
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { upsertJob, writeJobFile } from "../plugins/copilot/scripts/lib/state.mjs";
import { listJobsSummary } from "../plugins/copilot/scripts/lib/job-control.mjs";

describe("listJobsSummary", () => {
  let workspaceRoot;
  beforeEach(() => { workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "guide-jobs-")); });
  afterEach(() => { fs.rmSync(workspaceRoot, { recursive: true, force: true }); });

  it("returns zeroes for empty workspace", () => {
    const s = listJobsSummary(workspaceRoot, 30 * 24 * 60 * 60 * 1000);
    assert.equal(s.totalJobs, 0);
    assert.deepEqual(s.byKind, {});
  });

  it("aggregates job counts by kind", () => {
    const now = Date.now();
    upsertJob(workspaceRoot, { id: "a", kind: "review", status: "completed", startedAt: new Date(now - 100).toISOString(), completedAt: new Date(now).toISOString() });
    writeJobFile(workspaceRoot, "a", { id: "a", kind: "review" });
    upsertJob(workspaceRoot, { id: "b", kind: "task", status: "completed", startedAt: new Date(now - 200).toISOString(), completedAt: new Date(now).toISOString() });
    writeJobFile(workspaceRoot, "b", { id: "b", kind: "task" });
    const s = listJobsSummary(workspaceRoot, 30 * 24 * 60 * 60 * 1000);
    assert.equal(s.totalJobs, 2);
    assert.equal(s.byKind.review, 1);
    assert.equal(s.byKind.task, 1);
  });

  it("filters out jobs older than sinceMs", () => {
    const oldIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    upsertJob(workspaceRoot, { id: "old", kind: "review", status: "completed", startedAt: oldIso, completedAt: oldIso });
    writeJobFile(workspaceRoot, "old", { id: "old", kind: "review" });
    const s = listJobsSummary(workspaceRoot, 30 * 24 * 60 * 60 * 1000);
    assert.equal(s.totalJobs, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/job-summary.test.mjs`
Expected: FAIL with "listJobsSummary is not a function"

- [ ] **Step 3: Implement listJobsSummary**

Add to `plugins/copilot/scripts/lib/job-control.mjs` (append at end of file):

```js
export function listJobsSummary(workspaceRoot, sinceMs) {
  const cutoff = Date.now() - Math.max(0, Number(sinceMs) || 0);
  let jobs = [];
  try {
    jobs = listJobs(workspaceRoot);
  } catch {
    jobs = [];
  }
  const byKind = {};
  const durations = [];
  let totalJobs = 0;
  for (const job of jobs) {
    const startedMs = job.startedAt ? Date.parse(job.startedAt) : 0;
    if (Number.isNaN(startedMs) || startedMs < cutoff) continue;
    totalJobs += 1;
    const kind = job.kind ?? "unknown";
    byKind[kind] = (byKind[kind] ?? 0) + 1;
    if (job.completedAt) {
      const completedMs = Date.parse(job.completedAt);
      if (!Number.isNaN(completedMs) && completedMs >= startedMs) {
        durations.push(completedMs - startedMs);
      }
    }
  }
  const avgDurationMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;
  return { totalJobs, byKind, avgDurationMs };
}
```

Note: `listJobs` is already imported at the top of `job-control.mjs`. Verify the import line exists; if not, add `import { listJobs } from "./state.mjs";` to the imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/job-summary.test.mjs`
Expected: PASS, 3 tests

- [ ] **Step 5: Verify no regression**

Run: `node --test tests/job-control.test.mjs`
Expected: PASS (all pre-existing tests)

- [ ] **Step 6: Commit**

```bash
git add plugins/copilot/scripts/lib/job-control.mjs tests/job-summary.test.mjs
git commit -m "feat(guide): add listJobsSummary aggregator for audit mode"
```

---

## Task 9: Wire `guide` subcommand into copilot-companion.mjs

**Files:**
- Modify: `plugins/copilot/scripts/copilot-companion.mjs`
- Test: `tests/guide-subcommand.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/guide-subcommand.test.mjs`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "plugins", "copilot", "scripts", "copilot-companion.mjs"
);

describe("guide subcommand", () => {
  it("returns JSON profile with recommendedMode", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guide-sub-"));
    try {
      execSync("git init -q", { cwd: dir });
      execSync('git config user.email "t@t.io"', { cwd: dir });
      execSync('git config user.name "T"', { cwd: dir });
      fs.writeFileSync(path.join(dir, "a.txt"), "x\n");
      execSync("git add -A && git commit -q -m init", { cwd: dir });
      const home = fs.mkdtempSync(path.join(os.tmpdir(), "guide-home-"));
      try {
        const out = execFileSync("node", [SCRIPT, "guide", "--json", `--cwd=${dir}`], {
          env: { ...process.env, HOME: home },
          encoding: "utf8"
        });
        const parsed = JSON.parse(out);
        assert.ok(parsed.repo);
        assert.ok(parsed.claudeConfig);
        assert.ok(["onboarding", "migration", "audit"].includes(parsed.recommendedMode));
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/guide-subcommand.test.mjs`
Expected: FAIL with "Unknown subcommand: guide"

- [ ] **Step 3: Add handleGuide + wire into main switch**

In `plugins/copilot/scripts/copilot-companion.mjs`:

Add imports near top:

```js
import { buildGuideProfile } from "./lib/guide-profile.mjs";
import { listJobsSummary } from "./lib/job-control.mjs";
```

(Note: `listJobsSummary` may already be imported via the existing `job-control.mjs` import line — add it to the existing import statement if so. Do not duplicate.)

Add handler (insert near `handleSetup`, before `buildAdversarialReviewPrompt`):

```js
const AUDIT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

function handleGuide(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });
  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const profile = buildGuideProfile({ cwd, workspaceRoot });
  const output = {
    ...profile,
    jobSummary: listJobsSummary(workspaceRoot, AUDIT_LOOKBACK_MS)
  };
  // Always JSON for machine consumption; command file handles presentation.
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}
```

Add case to main switch (insert after `case "setup":`):

```js
    case "guide":
      handleGuide(argv);
      break;
```

Update usage string in `printUsage()` (insert line after the setup line):

```js
      "  node scripts/copilot-companion.mjs guide [--json]",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/guide-subcommand.test.mjs`
Expected: PASS, 1 test

- [ ] **Step 5: Run full suite — no regressions**

Run: `node --test tests/*.test.mjs`
Expected: 105+/107+ pass (2 pre-existing failures in runtime.test.mjs unchanged)

- [ ] **Step 6: Commit**

```bash
git add plugins/copilot/scripts/copilot-companion.mjs tests/guide-subcommand.test.mjs
git commit -m "feat(guide): wire guide subcommand into copilot-companion"
```

---

## Task 10: Create commands/guide.md (slash command prompt)

**Files:**
- Create: `plugins/copilot/commands/guide.md`

- [ ] **Step 1: Create the command file**

Create `plugins/copilot/commands/guide.md` with exact content:

````markdown
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
- End every mode with a final summary block listing: model used (GPT-5), typical cost, manual command (`/copilot:review`), disable command (`/copilot:setup --disable`), where findings appear (terminal — pipe with `--json` for scripts).
- Offer a `Try it now?` prompt at the end if the repo has staged changes — runs `/copilot:review --scope staged` via the Skill tool.

## Onboarding Mode (`profile.recommendedMode === "onboarding"`)

1. Show this concrete demo block verbatim (mark it as example output):

```
# example output — not a live run
$ /copilot:review
[Reviewing 2 staged files using GPT-5...]

## Findings
- [medium] auth.ts:47 — Missing input validation on user.email
  Recommendation: Validate format before passing to db.query()

Cost: ~$0.018  Time: 12s
```

2. Show the cheatsheet (4 lines):

```
Reviews use GPT-5 (different from Claude — second opinion)
Manual command: /copilot:review
Disable plugin:  /copilot:setup --disable
Typical cost:    ~$0.02 per review (varies with diff size)
```

3. If `profile.repo.sizeTier` is `"large"` or `"huge"`, announce: "Large repo detected — auto-applying summary mode for diffs >500 lines. Change later with `/copilot:setup --diff-threshold N`." Note this in the final summary as an applied change.

4. If `profile.claudeConfig.claudeMdHasManagedMarker` is true OR `profile.claudeConfig.claudeMdExists && !profile.claudeConfig.claudeMdWritable`, use AskUserQuestion exactly once:
   - Title: "Your CLAUDE.md is centrally managed / read-only. Where should I put Copilot guidance?"
   - Options:
     - `Create CLAUDE.local.md (only affects you)`
     - `Print a one-page cheatsheet (Recommended)`
     - `Skip — I'll remember the commands`

5. Build the menu based on detection:
   - Always include: `Add Copilot section to CLAUDE.md` (if writable and not already mentioning Copilot)
   - Include `Auto-review on git commit` — label `[local — only affects you]`
   - Include `Auto-review on Claude stop hook` — label `[local — only affects you]`
   - Include `Sub-agent self-review pattern` — label `[advanced]`
   - Include `Wire into existing pre-commit hook` — only if `profile.hooks.preCommit.present` is true, label `[modifies shared repo file]`
   - Include `CI integration guidance` — only if `profile.ciConfig.githubActions` is true

   Use AskUserQuestion with multi-select semantics (ask each option as y/N). Also offer "Not sure? Tell me what you want to do" — on free text, recommend 1-2 items.

6. For each picked item, ask at most 1-2 contextual questions at the moment of decision. For pre-commit: "Append to existing hook, or replace? Non-blocking warning or hard fail?" Default to append + non-blocking.

7. For each change: dry-run diff → confirm → apply.

8. Final summary + "Try it now?" prompt.

## Migration Mode (`profile.recommendedMode === "migration"`)

1. Show the differences block:

```
Detected: codex-plugin-cc installed.
This plugin works the same way. Differences:
  - Model: GPT-5 (Copilot's default) vs Codex's o-series
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

5. Final summary includes: changes applied, log location (`~/.copilot/logs/`), changelog link for plugin updates, and optional "Schedule next audit in 30 days?" prompt (no-op if user declines — we don't have scheduling yet, just surface the reminder option).

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
  - Model:    GPT-5 (~$0.02/review, varies with diff size)
  - Manual:   /copilot:review
  - Disable:  /copilot:setup --disable
  - Findings: printed to terminal (pipe with --json for scripts)
  - Logs:     ~/.copilot/logs/

Next: want to run /copilot:review on your current staged changes? [y/N]
```
````

- [ ] **Step 2: Verify frontmatter parses correctly**

Run: `head -6 plugins/copilot/commands/guide.md`
Expected: YAML frontmatter with `description`, `argument-hint`, `allowed-tools`.

- [ ] **Step 3: Commit**

```bash
git add plugins/copilot/commands/guide.md
git commit -m "feat(guide): add /copilot:guide slash command"
```

---

## Task 11: Modify /copilot:setup to offer the guide

**Files:**
- Modify: `plugins/copilot/commands/setup.md`

- [ ] **Step 1: Read the current setup.md content**

Run: `cat plugins/copilot/commands/setup.md`

Expected: existing setup command content with frontmatter and instructions to run setup script.

- [ ] **Step 2: Append the guide offer**

Add this section to the end of `plugins/copilot/commands/setup.md` (after the "Output rules" block):

```markdown

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
```

- [ ] **Step 3: Commit**

```bash
git add plugins/copilot/commands/setup.md
git commit -m "feat(setup): offer /copilot:guide to fresh users after readiness check"
```

---

## Task 12: Update testing-guide.md with guide command tests

**Files:**
- Modify: `docs/testing-guide.md`

- [ ] **Step 1: Add guide section to docs/testing-guide.md**

Insert a new section between "Part 3: Slash Command Tests" and "Part 4: Diff Size Gating" in `docs/testing-guide.md`:

```markdown
---

## Part 3.5: Guide Command (`/copilot:guide`)

Tests for the interactive onboarding/migration/audit command.

### Script-level (CLI)

| # | Test | Command | Expected |
|---|------|---------|----------|
| GU.1 | Profile JSON builds | `node plugins/copilot/scripts/copilot-companion.mjs guide --json` | Valid JSON with `environment`, `repo`, `claudeConfig`, `hooks`, `ciConfig`, `pluginState`, `otherPlugins`, `recommendedMode` |
| GU.2 | Mode routing — fresh | From a repo with no Copilot usage, no codex plugin, gate OFF | `recommendedMode === "onboarding"` |
| GU.3 | Mode routing — audit | After 6+ jobs run or gate enabled or CLAUDE.md mentions Copilot | `recommendedMode === "audit"` |
| GU.4 | Mode routing — migration | With `~/.claude/plugins/codex-plugin-cc/` directory present | `recommendedMode === "migration"` |
| GU.5 | Non-git repo | `cd /tmp && node .../copilot-companion.mjs guide --json` | `repo.isGitRepo === false` |
| GU.6 | Recent-commit sampling | On a repo with >1 commit | `repo.recentCommits.count > 0` with median/p95 values |

### Slash command

| # | Test | Method | Expected |
|---|------|--------|----------|
| GU.7 | Invoke via Skill tool | Skill(`copilot:guide`) | Runs interactive flow, routes to correct mode |
| GU.8 | Forced onboarding override | Skill(`copilot:guide`, "--onboarding") | Runs onboarding flow even if audit signals present |
| GU.9 | Dry-run before write | During any mode, when asked to write a file | Diff shown, confirm required before write |
| GU.10 | Read-only CLAUDE.md fallback | With a read-only or `# Managed by` CLAUDE.md | Offers `CLAUDE.local.md` / cheatsheet fallback, does not attempt write |
| GU.11 | Final summary present | At end of every flow | Summary lists applied changes + model + manual command + disable command + findings location |

### Setup integration

| # | Test | Method | Expected |
|---|------|--------|----------|
| GU.12 | Setup offers guide | After `/copilot:setup` on a fresh install | AskUserQuestion prompt offers `/copilot:guide` |
| GU.13 | Setup skips guide offer for returning users | After `/copilot:setup` with gate ON or jobs > 0 | No guide offer shown |
```

- [ ] **Step 2: Commit**

```bash
git add docs/testing-guide.md
git commit -m "docs: add /copilot:guide test matrix to testing guide"
```

---

## Task 13: Full regression + manual smoke test

**Files:** none modified

- [ ] **Step 1: Run the full unit suite**

Run: `cd /Users/marten/Code/agents/copilot-plugin-cc && node --test tests/*.test.mjs 2>&1 | tail -15`
Expected: 117+/119+ pass (105 previous + ~12 new tests), 2 pre-existing failures in runtime.test.mjs

- [ ] **Step 2: Run the CLI smoke test**

Run: `node plugins/copilot/scripts/copilot-companion.mjs guide --json | head -40`
Expected: JSON profile with all top-level keys and `recommendedMode` set to `onboarding` (or `audit` if this session has run jobs).

- [ ] **Step 3: Lint check — look for placeholder text**

Run: `grep -rn "TODO\|TBD\|FIXME" plugins/copilot/commands/guide.md plugins/copilot/scripts/lib/guide-profile.mjs`
Expected: no matches

- [ ] **Step 4: Confirm no regressions in existing commands**

Run: `node plugins/copilot/scripts/copilot-companion.mjs setup --json >/dev/null && echo "setup OK"`
Run: `node plugins/copilot/scripts/copilot-companion.mjs status >/dev/null && echo "status OK"`
Expected: both print OK.

- [ ] **Step 5: Commit tag for alpha.2**

Run: `git tag -f v2.1.0-alpha.1 && git push origin v2.1.0-alpha.1 --force`
Expected: Tag created and pushed.

---

## Self-Review Checklist

After all tasks complete, verify against the spec:

**Spec coverage:**
- [ ] Auto-detection: tasks 3–6 (git, CLAUDE.md, hooks, CI, plugin state, codex)
- [ ] Mode routing: task 1 (`resolveMode`)
- [ ] Profile assembly: task 7 (`buildGuideProfile`)
- [ ] `guide` subcommand: task 9
- [ ] Onboarding / Migration / Audit flows: task 10 (`guide.md`)
- [ ] Universal shared elements (demo, cheatsheet, menu, escape, dry-run, summary): task 10
- [ ] Read-only CLAUDE.md fallback: task 10
- [ ] Try-it-now post-setup: task 10
- [ ] Restore-codex rollback: task 10
- [ ] Setup integration: task 11
- [ ] Docs: task 12

**Placeholder scan:** run `grep -rn "TODO\|TBD" docs/superpowers/plans/2026-04-16-copilot-guide-command.md` — expected no matches (false positives in test strings are OK).

**Type consistency:** all function names match across tasks — `resolveMode`, `computeSizeTier`, `sampleRecentCommits`, `detectClaudeConfig`, `detectHooks`, `detectCiConfig`, `detectPluginState`, `detectOtherPlugins`, `buildGuideProfile`, `listJobsSummary`, `handleGuide`.
