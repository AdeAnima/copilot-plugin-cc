# Copilot Plugin for Claude Code

Fork of [wagnersza/copilot-plugin-cc](https://github.com/wagnersza/copilot-plugin-cc) with SDK stability and safety improvements.

Use GitHub Copilot CLI from within Claude Code for code review, adversarial review, task delegation, and background job management.

<video src="./docs/plugin-demo.webm" controls muted playsinline autoplay></video>

## Requirements

- Node.js 18.18 or later
- GitHub Copilot CLI (`@github/copilot-cli`)
- Active Copilot subscription ([plans](https://docs.github.com/en/copilot/about-github-copilot/subscription-plans-for-github-copilot))

## Installation

Add the marketplace and install the plugin:

```bash
/plugin marketplace add AdeAnima/copilot-plugin-cc
/plugin install copilot@AdeAnima
/reload-plugins
```

Verify the setup:

```bash
/copilot:setup
```

If Copilot CLI is not installed, `/copilot:setup` can install it via npm, or install manually:

```bash
npm install -g @github/copilot-cli
```

If Copilot is installed but not authenticated:

```bash
!copilot auth login
```

After install you should see the seven slash commands below and the `copilot:copilot-rescue` subagent in `/agents`.

## Commands

| Command | Description |
|---|---|
| `/copilot:review` | Code review with structured JSON output (summary, findings, suggestions). Supports `--scope auto\|working-tree\|branch\|staged`. |
| `/copilot:adversarial-review` | Pressure-test design decisions, tradeoffs, and failure modes. Steerable with free-text focus. |
| `/copilot:rescue` | Delegate tasks to Copilot. Read-only by default; pass `--write` to allow file edits. |
| `/copilot:status` | Show running/recent jobs and current review gate state. |
| `/copilot:result` | Display completed job output, including Copilot session ID for resuming. |
| `/copilot:cancel` | Cancel an active background job. |
| `/copilot:setup` | Verify install and authentication. Configure the review gate. |

## Command Details

### `/copilot:review`

Runs a Copilot code review and returns structured JSON output (summary, findings, suggestions) with a markdown fallback.

```bash
/copilot:review
/copilot:review --scope staged
/copilot:review --scope branch --base main
/copilot:review --background
```

Scope options:
- `auto` (default) — working tree if changes exist, otherwise branch vs. main
- `working-tree` — uncommitted changes
- `branch` — branch vs. `--base <ref>` (default: main)
- `staged` — staged changes only (`git diff --cached`)

Supports `--background` and `--wait`. Read-only, no file modifications.

### `/copilot:adversarial-review`

Steerable review that challenges implementation choices, design decisions, and assumptions.

```bash
/copilot:adversarial-review
/copilot:adversarial-review --scope staged challenge the error handling approach
/copilot:adversarial-review --base main look for race conditions and hidden assumptions
/copilot:adversarial-review --background question the chosen caching strategy
```

Takes the same `--scope` and `--base` flags as `/copilot:review`, plus optional free-text focus after the flags. Read-only, no file modifications.

### `/copilot:rescue`

Delegates a task to Copilot through the `copilot:copilot-rescue` subagent.

```bash
/copilot:rescue investigate why the tests started failing
/copilot:rescue --write fix the failing test with the smallest safe patch
/copilot:rescue --resume apply the top fix from the last run
/copilot:rescue --model gpt-5.4 --effort medium investigate the flaky integration test
/copilot:rescue --background investigate the regression
```

Flags: `--write`, `--background`, `--wait`, `--resume`, `--fresh`, `--model`, `--effort`.

By default rescue is read-only. Pass `--write` to allow file edits (see [Permission Model](#permission-model)).

### `/copilot:status`

Shows running and recent jobs for the current repository. Also displays the current review gate state.

```bash
/copilot:status
/copilot:status task-abc123
```

### `/copilot:result`

Shows the final output for a finished job. Includes the Copilot session ID when available so you can resume it directly with `copilot resume <session-id>`.

```bash
/copilot:result
/copilot:result task-abc123
```

### `/copilot:cancel`

Cancels an active background job.

```bash
/copilot:cancel
/copilot:cancel task-abc123
```

### `/copilot:setup`

Checks whether Copilot is installed and authenticated. Manages the review gate.

```bash
/copilot:setup
/copilot:setup --enable-review-gate
/copilot:setup --disable-review-gate
```

## Permission Model

Write permissions for `/copilot:rescue` depend on the review gate state:

| Gate state | `--write` flag | Behavior |
|---|---|---|
| OFF | not passed | Read-only (default) |
| OFF | passed | Requires explicit user approval |
| ON | passed | Auto-approved (gate catches issues before stop) |

## Review Gate

The review gate hooks into Claude's Stop event to run a targeted Copilot review based on Claude's response. If the review finds issues, the stop is blocked so Claude can address them first.

- **Off by default** — resets to OFF at the start of each session
- Enable per-session with `/copilot:setup --enable-review-gate`
- Current state visible in `/copilot:status`

> **Warning:** The review gate can create a long-running Claude/Copilot loop and may drain usage limits quickly. Only enable it when you plan to actively monitor the session.

## Typical Flows

### Review before shipping

```bash
/copilot:review
```

### Review only staged changes

```bash
/copilot:review --scope staged
```

### Delegate a task

```bash
/copilot:rescue investigate why the build is failing in CI
```

### Long-running work in the background

```bash
/copilot:adversarial-review --background
/copilot:rescue --background investigate the flaky test
# check progress later
/copilot:status
/copilot:result
```

## Configuration

The plugin uses your local Copilot CLI and picks up the same configuration:

- User-level: `~/.copilot/config.toml`
- Project-level: `.copilot/config.toml` (loaded only for [trusted projects](https://docs.github.com/en/copilot/configuring-github-copilot))

Example project config:

```toml
model = "gpt-5.4"
model_reasoning_effort = "xhigh"
```

## Lineage

This plugin is a fork of [wagnersza/copilot-plugin-cc](https://github.com/wagnersza/copilot-plugin-cc), which is itself adapted from OpenAI's [codex-plugin-cc](https://github.com/openai/codex-plugin-cc). This fork adds stability and safety improvements. See [CHANGELOG.md](./CHANGELOG.md) for the full list of changes.

## License

Apache-2.0 — see [NOTICE](./NOTICE) for attribution.
