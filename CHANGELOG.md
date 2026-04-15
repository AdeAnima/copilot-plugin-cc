# Changelog

## 2.0.0

### Breaking Changes

- **Rescue defaults to read-only.** Pass `--write` explicitly to allow Copilot to edit files. Previously writes were enabled by default.

### Features

- **SDK stability:** Pinned `@github/copilot-sdk` to exact version (0.2.2) with committed lockfile. Graceful error messages when SDK is missing or version-mismatched.
- **Gate-linked permissions:** Write permissions are auto-approved when review gate is ON (safety net catches issues). When gate is OFF, writes require explicit user approval.
- **Staged review scope:** Added `--scope staged` to `/copilot:review` and `/copilot:adversarial-review` for reviewing only staged changes (`git diff --cached`).
- **Structured standard review:** `/copilot:review` now returns structured JSON output (summary, findings, suggestions) with markdown fallback.
- **Session-scoped review gate:** Gate resets to OFF at the start of each session. Enable per-session with `/copilot:setup --enable-review-gate`.
- **Gate status in `/copilot:status`:** Shows whether the review gate is currently active.

### Fixes

- SDK permission requests are no longer silently auto-approved in all cases.
- SDK load failures now surface actionable error messages instead of failing silently.
