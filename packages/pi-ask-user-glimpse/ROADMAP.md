# ROADMAP — pi-ask-user-glimpse

## Known Issues

### Image Attachment Bug in `ask_user` Responses
- **Status:** Defensively mitigated in extension; upstream fix still required
- **Description:** When the assistant uses the `ask_user` tool to ask the user a question, and the user responds with plain text, the system sometimes injects "(see attached image)" into the assistant's context even though no image was sent by the user.
- **Impact:** Breaks the grilling session flow; forces the assistant to ask for clarification, disrupting the one-question-at-a-time pattern.
- **Occurrences:** 2026-05-22, during `grill-with-docs` skill session. Happened twice in the same conversation.
- **Root Cause:** The string `"(see attached image)"` is hardcoded in Pi's `pi-ai` package as a fallback placeholder for tool results with empty text content. Specifically:
  - `openai-completions.js`: `content: sanitizeSurrogates(hasText ? textResult : "(see attached image)")` — **always** uses the image placeholder when text is empty, regardless of whether images exist.
  - `anthropic.js`: Inserts `{ type: "text", text: "(see attached image)" }` when no text blocks exist, also regardless of images.
  - `google-shared.js` and `mistral.js`: Correctly gate the placeholder behind `hasImages`.
- **Trigger Conditions:** The bug fires when the `ask_user` tool result has empty text. This can happen when:
  1. User submits an empty freeform response (presses Enter without typing).
  2. User makes no selection and leaves no comment in a select dialog.
  3. A race condition or message-pipeline bug causes the text content to be dropped before reaching the provider layer.
- **Extension Defensive Fix (applied):** `responseToText()` in `tool/response-formatter.ts` never returns empty text. For empty selections, unanswered questions, or empty freeform input, it returns `"No response"` instead of `""

## Planned Improvements

### Enhanced Visualization Support in HTML Context
- **Goal:** Expand `promptGuidelines` and provide helper utilities so agents generate richer visualizations (tables, charts, comparisons) in the HTML context panel.
- **Status:** **Implemented in v0.4.1+**
- **Files:**
  - `webview/src/util/pi-charts.ts` — the `window.pi` micro library
  - `webview/src/components/ContextPanel.tsx` — auto-injects library into iframe srcDoc
  - `index.ts` — updated `promptGuidelines` and `description`

**Library API:**
- `pi.barChart(selector, data, {title, showValues, highlightIndex})` — SVG bar chart
- `pi.pieChart(selector, data, {title, donut, showLegend})` — SVG pie/donut chart
- `pi.table(selector, headers, rows, {caption, highlightColumn, striped})` — styled comparison table
- `pi.prosCons(selector, pros, cons, {title, prosTitle, consTitle})` — two-column layout
- `pi.timeline(selector, events, {title})` — horizontal timeline
- `pi.metrics(selector, cards, {title, columns})` — grid of metric cards

All helpers read CSS custom properties (`--primary`, `--foreground`, etc.) for automatic light/dark theme consistency.

**Dark Mode Improvements (2026-05-22):**
- Charts (bar, pie, timeline) and table now wrapped in bordered card containers for visual separation
- Table highlights use higher opacity (0.25) in dark mode vs 0.12 in light mode
- Pros/Cons markers use colored circle badges (green `+` for Pros, red `−` for Cons) with white symbols
- Metrics down-trend badges use bright red (`hsl(0 80% 60%)`) instead of dark `--destructive`
- Pie chart palette uses coral (`hsl(350 90% 65%)`) instead of rose for better dark mode visibility
- Legend text uses `--foreground` at 75% opacity instead of `--muted-foreground`

### Sandbox Relaxation Investigation
- **Goal:** Determine if the iframe sandbox can be safely relaxed to support richer visualization libraries (D3, p5.js, etc.), and what the security trade-offs are.
- **Status:** Complete — See findings below.
- **Owner:** Agent investigation

**Findings (2026-05-22):**
- `allow-same-origin` is **UNSAFE**: Parent loaded via `loadHTMLString` has origin `null`; iframe with `allow-same-origin` + `srcDoc` also gets origin `null`, making them same-origin. The iframe could then access `parent.document`, steal the `ask_user` payload, and modify the parent DOM.
- External `<script src>` loading **WORKS** in the main Glimpse window (tested D3 CDN loads successfully in WKWebView).
- External script loading in the **iframe** is technically possible (sandbox doesn't block network), but discouraged for self-containment.
- `localStorage` is **BLOCKED** in both main window and iframe (null origin / opaque origin).
- **Inline SVG** and **Canvas 2D** both work in the HTML context iframe.
- **Verdict:** Do NOT relax the sandbox. Instead, provide inline helper utilities for chart/table generation.

## Completed

- ~~HTML context iframe with theme propagation~~ (v0.4.0)
- ~~Mermaid diagram support in markdown context~~ (v0.3.0)
- ~~Auto-catch free-form questions~~ (v0.4.0) — **Removed in v0.5.0**: caused excessive dialog interruptions
