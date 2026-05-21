---
max_words: 12
---
Summarize what the agent accomplished in this turn. Use past tense.

RULES:
- Echo the ORIGINAL GOAL's key words in your summary (e.g., if goal is "Fix JWT bug", say "Fixed JWT bug in..." not "Updated auth code")
- MUST mention specific files, commands, or counts when available (e.g., "src/auth.ts", "3 files", "npm test")
- MUST stay under {max_words} words — truncate ruthlessly
- NO generic filler like "some updates" or "various changes"
- If no tools were used, summarize the concrete explanation or plan delivered

Original goal: {goal}
Agent output: {message}
