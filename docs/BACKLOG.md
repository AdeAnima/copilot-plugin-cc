# Backlog

Ideas captured mid-session that should be designed and implemented later. Each entry is a seed, not a spec.

---

## CTO / Tech-Lead Review Mode

**Captured:** 2026-04-16

A new review mode that evaluates technical outlines, specs, plans, RFCs, or ADRs from a CTO / tech-lead perspective — challenges the plan itself, not the code.

**Distinct from existing commands:**
- `/copilot:review` — standard code review of a diff
- `/copilot:adversarial-review` — adversarial code review (attacks implementation)
- **CTO review (new)** — attacks the *plan*: whether the plan is the right plan, considering scope, prioritization, tech choices, risk vs. reward, hidden dependencies, 6-12 month implications

**Input:** a document path (spec, plan, ADR, RFC, architecture outline) — not a git diff.

**Lens:** strategic, not tactical. Questions:
- Is this solving the right problem?
- Does the scope match the value?
- What are the hidden dependencies?
- What's missing from the plan (common failure modes)?
- Are better alternatives ignored?
- How does this age over 6-12 months?
- Team fit: can the team actually build/maintain this?
- Buy vs. build signals

**Output shape (proposed):**
- Verdict: `ship` / `revise` / `rethink`
- Concerns grouped by: `architecture`, `scope`, `risk`, `unknowns`, `alternatives`
- Each concern: severity (critical/medium/low), why flagged, suggested direction

**Command shape options:**
- New slash command: `/copilot:cto-review <path-to-doc>` or `/copilot:plan-review <path>`
- Flag on existing command: `/copilot:adversarial-review --lens=cto <path>`
- Takes a document path, not a diff — requires new input pathway in `copilot-companion.mjs`

**Brainstorm before implementation.** Open questions:
- Should it require a specific input format (headers, sections) or work on any markdown?
- Can it pull in repo context (existing code, CLAUDE.md) to evaluate the plan against reality?
- Is this one command, or a family (CTO review, product review, security review)?

**Blocked by:** nothing. Can start brainstorming after `/copilot:guide` ships.
