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
