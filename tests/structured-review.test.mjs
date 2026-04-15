import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseStructuredReview } from "../plugins/copilot/scripts/lib/review-parser.mjs";

describe("parseStructuredReview", () => {
  it("parses valid JSON review output", () => {
    const input = JSON.stringify({
      summary: "No critical issues found.",
      findings: [
        { severity: "low", title: "Minor nit", body: "Consider renaming this variable." }
      ],
      suggestions: []
    });

    const result = parseStructuredReview(input);
    assert.equal(result.structured, true);
    assert.equal(result.data.summary, "No critical issues found.");
    assert.equal(result.data.findings.length, 1);
    assert.equal(result.data.findings[0].severity, "low");
  });

  it("extracts JSON from mixed markdown (wrapped in ```json code block)", () => {
    const input = [
      "Here is my review:",
      "```json",
      JSON.stringify({
        summary: "Looks good overall.",
        findings: [],
        suggestions: [{ title: "Add tests", body: "Coverage is low." }]
      }),
      "```",
      "Let me know if you have questions."
    ].join("\n");

    const result = parseStructuredReview(input);
    assert.equal(result.structured, true);
    assert.equal(result.data.summary, "Looks good overall.");
    assert.equal(result.data.suggestions.length, 1);
  });

  it("falls back to raw text when no valid JSON found", () => {
    const input = "This is a plain text review with no JSON.";

    const result = parseStructuredReview(input);
    assert.equal(result.structured, false);
    assert.equal(result.raw, input);
  });

  it("falls back when JSON has invalid severity values", () => {
    const input = JSON.stringify({
      summary: "Found issues.",
      findings: [
        { severity: "urgent", title: "Bad severity", body: "This severity is not valid." }
      ]
    });

    const result = parseStructuredReview(input);
    assert.equal(result.structured, false);
    assert.equal(result.raw, input);
  });

  it("handles empty input", () => {
    const result = parseStructuredReview("");
    assert.equal(result.structured, false);
  });
});
