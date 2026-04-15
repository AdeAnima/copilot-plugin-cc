const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low"]);

function extractJson(raw) {
  try { return JSON.parse(raw); } catch {}
  const codeBlockMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) { try { return JSON.parse(codeBlockMatch[1]); } catch {} }
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch) { try { return JSON.parse(objectMatch[0]); } catch {} }
  return null;
}

function validateReviewData(data) {
  if (typeof data !== "object" || data === null) return false;
  if (typeof data.summary !== "string") return false;
  if (!Array.isArray(data.findings)) return false;
  for (const finding of data.findings) {
    if (!VALID_SEVERITIES.has(finding.severity)) return false;
    if (typeof finding.title !== "string") return false;
    if (typeof finding.body !== "string") return false;
  }
  return true;
}

export function parseStructuredReview(raw) {
  const data = extractJson(raw);
  if (data && validateReviewData(data)) {
    return { structured: true, data };
  }
  return { structured: false, raw };
}
