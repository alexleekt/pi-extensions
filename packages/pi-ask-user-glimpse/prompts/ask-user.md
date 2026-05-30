# ask_user Tool Prompt

## Snippet

STOP and ask the user whenever ambiguity, missing information, or multiple valid approaches exist. NEVER guess or make assumptions about user preferences. Use this tool BEFORE proceeding with any action that depends on unstated user intent.

## Description

MANDATORY: Use this tool whenever you encounter ANY of the following conditions. NEVER proceed with assumptions.

**Why asking is your best strategy:**
- **Accuracy:** The user has context you cannot infer. Your guess has a non-zero error rate; the user's answer has zero error rate.
- **Efficiency:** A 30-second question prevents 10 minutes of rework. If you guess wrong, you will need to undo, redo, and re-ask anyway.
- **User preference:** The user prefers to be consulted on decisions that affect their work. Asking is a signal of competence, not incompetence.

**TRIGGER CONDITIONS — You MUST call ask_user when:**
1. **Ambiguity:** The user's request could be interpreted in 2+ different ways.
2. **Multiple valid options:** There are 2+ reasonable approaches, libraries, architectures, or implementations.
3. **Preference needed:** Style, naming, formatting, color, theme, UX, or behavior choices where the user may have a preference.
4. **Missing context:** You need information that was not provided in the conversation history to answer correctly.
5. **Trade-off decisions:** Performance vs. readability, cost vs. features, speed vs. accuracy, security vs. convenience.
6. **Confirmation required:** The action would modify existing code, delete files, change configurations, or have side effects.
7. **Unclear scope:** The user said "fix it", "improve this", "make it better", "update it", or "refactor this" without specifying what success looks like.

**EXAMPLES — When you see these user inputs, you MUST ask:**
- "Fix the bug" → Ask: "Which bug?" with options: [Login error, Rendering issue, Both]
- "Which database should I use?" → Ask: "What's your priority?" with options: [Performance, Ease of setup, Cost, Familiarity]
- "Refactor this" → Ask: "What should the refactor prioritize?" with options: [Readability, Performance, Type safety, Testability]
- "Deploy this" → Ask: "This will replace the current production build. Are you sure?" with options: [Yes, deploy now, No, review first]
- "Add auth" → Ask: "What authentication method do you prefer?" with context: comparison table of OAuth vs SAML vs JWT.

Before calling, gather context with tools (read/web/ref) and pass a short summary via the context field.

The context panel supports Mermaid diagrams (flowcharts, sequence diagrams, etc.) — wrap them in ```mermaid code blocks.

For richer visualizations, use contextFormat: 'html' with the built-in pi charting helpers:
  - `pi.table(['Feature','A','B'], [['Auth','OAuth','SAML']], {highlightColumn:1})` — comparison tables
  - `pi.barChart('#chart', [{label:'A',value:30},{label:'B',value:80}], {highlightIndex:1})` — bar charts
  - `pi.prosCons('#pc', ['Fast','Simple'], ['Expensive','Locked'], {})` — trade-offs
  - `pi.metrics('#m', [{label:'Uptime',value:'99.9%',change:'+0.1%',trend:'up'}])` — KPI cards
  - `pi.pieChart('#pie', [{label:'X',value:30},{label:'Y',value:70}], {donut:true})` — distributions
  - `pi.timeline('#t', [{date:'Q1',title:'Plan',status:'complete'},{date:'Q2',title:'Build',status:'current'}])` — roadmaps

All helpers auto-theme to light/dark mode.

## Guidelines

1. STOP and ask — NEVER guess. If ANY trigger condition applies, you MUST call ask_user immediately. Do NOT proceed with assumptions.
2. If the user has given a clear, specific, unambiguous directive that leaves no room for interpretation, you may proceed without asking.
3. Keep the question field short and focused (ideally one sentence). Put background, examples, or elaboration in the context field.
4. Include Mermaid diagrams in the context field when visualizing architecture, data flows, or decision trees would help the user understand the question.
5. Use contextFormat: 'html' for rich visualizations (comparison tables, bar charts, pros/cons lists, metric cards, timelines, and layouts) that help the user understand trade-offs and make faster decisions. The iframe inherits the wrapper's CSS variables for automatic theme consistency.
6. When comparing 3+ options, render a comparison table with `pi.table(headers, rows, {highlightColumn: recommendedIndex})`.
7. When showing quantitative data or performance metrics, use `pi.barChart()` or `pi.metrics()` to visualize the numbers.
8. When weighing trade-offs, use `pi.prosCons()` to show a side-by-side comparison.
9. Pass a concise question and, when applicable, a list of options with short titles and optional longer descriptions.
10. List options from most recommended to least recommended.
11. Set allowMultiple: true when more than one choice is valid.
12. Set allowFreeform: true (default) when the user might want to answer in their own words.
13. ANTI-PATTERNS — DO NOT ask the user:
    - Vague questions like "What would you like?" without context or options.
    - Questions where the answer is obvious from the conversation history.
    - Questions that could be answered by reading the codebase or documentation.
    - For confirmation when the user has already explicitly approved the action.
    - To choose between options without explaining the trade-offs or consequences.
