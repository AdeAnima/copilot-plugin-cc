import { binaryAvailable, runCommand } from "./process.mjs";

const SESSION_ID_ENV = "COPILOT_COMPANION_SESSION_ID";
const DEFAULT_CONTINUE_PROMPT =
  "Continue from the current thread state. Pick the next highest-value step and follow through until the task is resolved.";
const TASK_SESSION_PREFIX = "Copilot Companion Task";

let _client = null;
let _copilotClientFn = null;

// Test hooks — for injecting fake SDK loaders in tests only
export function _resetClient() {
  _client = null;
}

export function _setCopilotClientFn(fn) {
  _copilotClientFn = fn;
}

function shorten(text, limit = 72) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

async function getCopilotClient() {
  const loader = _copilotClientFn ?? (async () => {
    const { CopilotClient } = await import("@github/copilot-sdk");
    return CopilotClient;
  });

  try {
    return await loader();
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find module")) {
      throw new Error(
        "@github/copilot-sdk is not installed. Run /copilot:setup to fix this."
      );
    }
    throw new Error(
      "Failed to load @github/copilot-sdk — possible version mismatch. Run /copilot:setup to check."
    );
  }
}

export async function ensureClient() {
  if (!_client) {
    const CopilotClient = await getCopilotClient();
    const instance = new CopilotClient();
    try {
      await instance.start();
    } catch (err) {
      throw new Error(
        `Failed to start @github/copilot-sdk — possible version mismatch. Run /copilot:setup to check. (${err.message})`
      );
    }
    _client = instance;
  }
  return _client;
}

export async function shutdownClient() {
  if (_client) {
    await _client.stop();
    _client = null;
  }
}

export async function createSession(options = {}) {
  const client = await ensureClient();
  return client.createSession({
    model: options.model || undefined,
    streaming: true,
    sessionId: options.sessionId || undefined,
    systemMessage: options.systemMessage || undefined,
    tools: options.tools || undefined,
    onPermissionRequest: async () => ({ kind: "approved" }),
    ...(options.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {})
  });
}

export async function runPrompt(session, prompt, options = {}) {
  const { onProgress } = options;
  const chunks = [];
  const reasoning = [];

  session.on((event) => {
    const eventType = event.type?.value ?? event.type;
    switch (eventType) {
      case "assistant.message_delta":
        chunks.push(event.data.deltaContent || "");
        onProgress?.({
          message: `Streaming response...`,
          phase: "running",
          stderrMessage: null,
          logTitle: null,
          logBody: null
        });
        break;
      case "assistant.reasoning_delta":
        reasoning.push(event.data.deltaContent || "");
        break;
      case "tool.execution_start":
        onProgress?.({
          message: `Running tool: ${event.data.toolName}.`,
          phase: "investigating",
          stderrMessage: `Running tool: ${event.data.toolName}`,
          logTitle: null,
          logBody: null
        });
        break;
      case "tool.execution_complete": {
        const status = event.data.success ? "completed" : "failed";
        onProgress?.({
          message: `Tool ${event.data.toolName} ${status}.`,
          phase: "running",
          stderrMessage: `Tool ${event.data.toolName} ${status}`,
          logTitle: null,
          logBody: null
        });
        break;
      }
      case "session.idle":
        onProgress?.({
          message: "Turn completed.",
          phase: "finalizing",
          stderrMessage: null,
          logTitle: null,
          logBody: null
        });
        break;
      default:
        break;
    }
  });

  const response = await session.sendAndWait({ prompt });
  const content = response?.data?.content ?? chunks.join("");

  return {
    content,
    reasoning: reasoning.join(""),
    sessionId: session.config?.sessionId ?? null
  };
}

export async function abortSession(session) {
  await session.abort();
}

export function getCopilotAvailability(cwd) {
  return binaryAvailable("copilot", ["--version"], { cwd });
}

export function getSessionRuntimeStatus(env = process.env) {
  return {
    mode: "sdk",
    label: "SDK managed",
    detail: "Copilot CLI process managed by @github/copilot-sdk."
  };
}

export function getCopilotLoginStatus(cwd) {
  const availability = getCopilotAvailability(cwd);
  if (!availability.available) {
    return { available: false, loggedIn: false, detail: availability.detail };
  }
  return { available: true, loggedIn: true, detail: "assumed authenticated" };
}

export function parseStructuredOutput(rawOutput, fallback = {}) {
  if (!rawOutput) {
    return {
      parsed: null,
      parseError: fallback.failureMessage ?? "Copilot did not return a final structured message.",
      rawOutput: rawOutput ?? "",
      ...fallback
    };
  }
  try {
    return { parsed: JSON.parse(rawOutput), parseError: null, rawOutput, ...fallback };
  } catch (error) {
    return { parsed: null, parseError: error.message, rawOutput, ...fallback };
  }
}

export function buildPersistentTaskSessionId(prompt) {
  const excerpt = shorten(prompt, 56);
  const slug = excerpt
    ? excerpt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    : "";
  const prefix = TASK_SESSION_PREFIX.toLowerCase().replace(/\s+/g, "-");
  return slug ? `${prefix}-${slug}` : prefix;
}

export { DEFAULT_CONTINUE_PROMPT, TASK_SESSION_PREFIX, SESSION_ID_ENV };
