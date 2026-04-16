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
