Please review the following {{TARGET_LABEL}} diff and provide a structured code review.

<review_input>
{{REVIEW_INPUT}}
</review_input>

<structured_output_contract>
Respond with a JSON object matching this schema:

{
  "summary": "Brief overall assessment",
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "title": "Short finding title",
      "body": "Detailed explanation",
      "file": "path/to/file",
      "line_start": 10,
      "line_end": 15,
      "recommendation": "How to fix"
    }
  ],
  "suggestions": [
    {
      "title": "Optional improvement",
      "body": "Why and how",
      "file": "path/to/file"
    }
  ]
}

If there are no issues, return: {"summary": "No issues found.", "findings": [], "suggestions": []}
</structured_output_contract>
