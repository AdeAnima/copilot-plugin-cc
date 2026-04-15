import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildPermissionHandler } from "../plugins/copilot/scripts/lib/copilot-client.mjs";

describe("buildPermissionHandler", () => {
  // --- Read operations ---

  it("read ops always approved — gate ON", async () => {
    const handler = buildPermissionHandler({ gateEnabled: true, interactive: false });
    const result = await handler({ tool: "file_read", path: "/some/file.txt" });
    assert.deepEqual(result, { kind: "approved" });
  });

  it("read ops always approved — gate OFF, non-interactive", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "file_read", path: "/some/file.txt" });
    assert.deepEqual(result, { kind: "approved" });
  });

  it("unknown/unlisted tool approved (treated as read)", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "web_search" });
    assert.deepEqual(result, { kind: "approved" });
  });

  // --- Gate ON: write ops auto-approved ---

  it("file_write approved when gate ON", async () => {
    const handler = buildPermissionHandler({ gateEnabled: true, interactive: false });
    const result = await handler({ tool: "file_write", path: "/tmp/out.txt" });
    assert.deepEqual(result, { kind: "approved" });
  });

  it("file_edit approved when gate ON", async () => {
    const handler = buildPermissionHandler({ gateEnabled: true, interactive: false });
    const result = await handler({ tool: "file_edit", path: "/tmp/edit.txt" });
    assert.deepEqual(result, { kind: "approved" });
  });

  it("file_delete approved when gate ON", async () => {
    const handler = buildPermissionHandler({ gateEnabled: true, interactive: false });
    const result = await handler({ tool: "file_delete", path: "/tmp/delete.txt" });
    assert.deepEqual(result, { kind: "approved" });
  });

  it("shell_execute approved when gate ON", async () => {
    const handler = buildPermissionHandler({ gateEnabled: true, interactive: false });
    const result = await handler({ tool: "shell_execute" });
    assert.deepEqual(result, { kind: "approved" });
  });

  it("command_execute approved when gate ON", async () => {
    const handler = buildPermissionHandler({ gateEnabled: true, interactive: false });
    const result = await handler({ tool: "command_execute" });
    assert.deepEqual(result, { kind: "approved" });
  });

  // --- Gate OFF, non-interactive: write ops denied ---

  it("file_write denied when gate OFF, non-interactive", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "file_write", path: "/tmp/out.txt" });
    assert.deepEqual(result, { kind: "denied" });
  });

  it("file_edit denied when gate OFF, non-interactive", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "file_edit", path: "/tmp/edit.txt" });
    assert.deepEqual(result, { kind: "denied" });
  });

  it("file_delete denied when gate OFF, non-interactive", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "file_delete", path: "/tmp/delete.txt" });
    assert.deepEqual(result, { kind: "denied" });
  });

  it("shell_execute denied when gate OFF, non-interactive", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "shell_execute" });
    assert.deepEqual(result, { kind: "denied" });
  });

  it("command_execute denied when gate OFF, non-interactive", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "command_execute" });
    assert.deepEqual(result, { kind: "denied" });
  });

  // --- Copilot CLI actual tool names ---

  it("'edit' (Copilot CLI tool) denied when gate OFF, non-interactive", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "edit", path: "/tmp/file.js" });
    assert.deepEqual(result, { kind: "denied" });
  });

  it("'bash' (Copilot CLI tool) denied when gate OFF, non-interactive", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "bash" });
    assert.deepEqual(result, { kind: "denied" });
  });

  it("'edit' approved when gate ON", async () => {
    const handler = buildPermissionHandler({ gateEnabled: true, interactive: false });
    const result = await handler({ tool: "edit", path: "/tmp/file.js" });
    assert.deepEqual(result, { kind: "approved" });
  });

  it("'bash' approved when gate ON", async () => {
    const handler = buildPermissionHandler({ gateEnabled: true, interactive: false });
    const result = await handler({ tool: "bash" });
    assert.deepEqual(result, { kind: "approved" });
  });

  it("'view' (Copilot CLI read tool) always approved", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "view" });
    assert.deepEqual(result, { kind: "approved" });
  });

  it("'glob' (Copilot CLI read tool) always approved", async () => {
    const handler = buildPermissionHandler({ gateEnabled: false, interactive: false });
    const result = await handler({ tool: "glob" });
    assert.deepEqual(result, { kind: "approved" });
  });

  // --- Default options ---

  it("defaults to gate OFF, non-interactive — denies writes", async () => {
    const handler = buildPermissionHandler();
    const result = await handler({ tool: "file_write", path: "/tmp/x.txt" });
    assert.deepEqual(result, { kind: "denied" });
  });

  it("defaults to gate OFF, non-interactive — approves reads", async () => {
    const handler = buildPermissionHandler();
    const result = await handler({ tool: "file_read", path: "/tmp/x.txt" });
    assert.deepEqual(result, { kind: "approved" });
  });
});
