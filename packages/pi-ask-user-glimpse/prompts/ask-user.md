## Snippet
Ask one focused question with optional multiple-choice answers. Use when the user knows something you can't infer; skip when the directive is clear and unambiguous.

## Description
`ask_user` renders your question as a native dialog with a context panel for evidence, trade-off analysis, and visual aids. The tool is your decision-presentation canvas: when you do need the user to choose, you can give them comparison tables, Mermaid diagrams, HTML charts, pros/cons layouts, and structured options — all auto-themed to their environment.

**When to ask.** Call `ask_user` when the user's answer has zero error rate and your best guess does not. Concretely:

1. **Ambiguity** — The request could mean 2+ different things.
2. **Multiple valid approaches** — 2+ libraries, architectures, or implementations are reasonable.
3. **Preference** — Style, naming, UX, color, or behavior where the user may have a preference.
4. **Missing information** — You need context not available in the conversation history.
5. **Trade-offs** — Performance vs. readability, cost vs. features, speed vs. accuracy.
6. **Irreversible action** — Modifying existing code, deleting files, changing configs, deploying.
7. **Underspecified request** — "fix it", "improve this", "refactor this" without success criteria.

**When not to ask.** Skip `ask_user` and proceed directly when:

- The user gave a specific, unambiguous directive ("rename X to Y in file Z").
- The answer is obvious from conversation history or a quick codebase inspection.
- The user already authorized the action ("go ahead", "approved", "ship it").
- The choice is trivial and your default has near-zero risk of being wrong.
- The user signaled low-friction execution ("just do it", "don't ask", "no questions").

**Examples of effective `ask_user` calls:**

- "Fix the bug" → "Which bug? I found two." with options: [Login crash (null user), Dashboard flicker (missing key)]
- "Add auth" → "Which auth approach fits your scale?" with a comparison table in context: JWT vs OAuth vs SAML
- "Which database?" → "Here are the trade-offs:" with a Mermaid decision flowchart and a `pi.table()` comparison
- "Refactor this" → "What should the refactor prioritize?" with options: [Readability, Performance, Type safety]

**When you do ask:** Put evidence and analysis in the context panel. Use markdown (with Mermaid for flows) by default; switch to `contextFormat: 'html'` for charts and dashboards. Always provide clear, actionable options sorted by recommendation.

## Guidelines
1. When the user gives a specific, unambiguous directive, execute it without asking.
2. Keep the question to one sentence. Move background, evidence, and analysis to the context field.
3. Provide concrete options whenever possible — even for open-ended questions, suggest a few likely answers.
4. List options from most recommended to least recommended, and mark top picks with `recommended: true`.
5. Set `allowMultiple: true` when the user might reasonably choose several valid options.
6. Keep `allowFreeform: true` (the default) so the user can override your suggestions.
7. When comparing 3+ options, render a table with `pi.table(headers, rows, {highlightColumn: recommendedIndex})`.
8. When presenting quantitative data, use `pi.barChart()` or `pi.metrics()`.
9. When weighing trade-offs, use `pi.prosCons('#id', pros, cons, {})` for side-by-side comparison.
10. Use `contextFormat: 'html'` with `pi.timeline()` for roadmaps and `pi.pieChart()` for distributions.
11. Include Mermaid diagrams in markdown context to visualize flows, architectures, and decision trees.
12. DO NOT ask vague questions like "What would you like?" without context or structured options.
13. DO NOT ask for confirmation the user already gave.
14. DO NOT present options without explaining the trade-offs — the context panel is your canvas.
