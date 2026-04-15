import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  ensureClient,
  _resetClient,
  _setCopilotClientFn
} from "../plugins/copilot/scripts/lib/copilot-client.mjs";

describe("sdk-stability: getCopilotClient error handling", () => {
  beforeEach(() => {
    _resetClient();
  });

  afterEach(() => {
    _resetClient();
    // Restore to default real loader
    _setCopilotClientFn(null);
  });

  it("throws actionable message when SDK module is not found", async () => {
    const moduleNotFoundError = new Error("Cannot find module '@github/copilot-sdk'");
    moduleNotFoundError.code = "ERR_MODULE_NOT_FOUND";

    _setCopilotClientFn(async () => {
      throw moduleNotFoundError;
    });

    await assert.rejects(
      () => ensureClient(),
      (err) => {
        assert.ok(
          err.message.includes("@github/copilot-sdk is not installed"),
          `Expected 'not installed' message, got: ${err.message}`
        );
        assert.ok(
          err.message.includes("/copilot:setup"),
          `Expected setup command reference, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it("throws actionable message for non-module-not-found errors (version mismatch)", async () => {
    _setCopilotClientFn(async () => {
      throw new Error("Unexpected token in JSON");
    });

    await assert.rejects(
      () => ensureClient(),
      (err) => {
        assert.ok(
          err.message.includes("Failed to load @github/copilot-sdk"),
          `Expected 'failed to load' message, got: ${err.message}`
        );
        assert.ok(
          err.message.includes("version mismatch"),
          `Expected 'version mismatch' mention, got: ${err.message}`
        );
        assert.ok(
          err.message.includes("/copilot:setup"),
          `Expected setup command reference, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it("throws actionable message when client.start() fails", async () => {
    _setCopilotClientFn(async () => {
      return class FakeClient {
        async start() {
          throw new Error("Protocol version mismatch: expected 2.0, got 1.9");
        }
      };
    });

    await assert.rejects(
      () => ensureClient(),
      (err) => {
        assert.ok(
          err.message.includes("Failed to start @github/copilot-sdk"),
          `Expected 'failed to start' message, got: ${err.message}`
        );
        assert.ok(
          err.message.includes("/copilot:setup"),
          `Expected setup command reference, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it("succeeds when fake SDK loader returns a working client class", async () => {
    _setCopilotClientFn(async () => {
      return class FakeClient {
        async start() {}
        async stop() {}
        async createSession() {
          return { on() {}, async sendAndWait() { return { data: { content: "ok" } }; } };
        }
      };
    });

    const client = await ensureClient();
    assert.ok(client, "Expected a client to be returned");
  });
});
