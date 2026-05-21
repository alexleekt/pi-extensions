# Context — pi-ask-user-glimpse

## Glossary

| Term | Definition |
|------|------------|
| **Dialog type** | One of four UI layouts: `single-select`, `multi-select`, `freeform`, `questionnaire`. Determined from the `ask_user` payload. |
| **Payload** | The `AskUserPayload` object injected into the webview HTML as `window.__ASK_USER_PAYLOAD__`. Contains question text, options, flags, and session metadata. |
| **Context panel** | The left-side markdown renderer in two-panel mode. Only visible when `context` is provided in the payload. |
| **Theme mode** | One of `light`, `dark`, or `system`. Controls the webview color scheme. Persisted in localStorage. |
| **Resolved theme** | The actual `light` or `dark` value computed from the theme mode. `system` resolves via `prefers-color-scheme`. |
| **Animation level** | One of `none`, `minimal`, or `all`. Controls CSS transition intensity across the UI. |
| **Header bar** | The branded bar at the top of every dialog containing the logo, title, help icon, and settings cog. |
| **Session name** | The user-defined display name of the Pi session, sourced from `sessionManager.getSessionName()`. Used in the native window title. |
| **Stopword** | A common English word (e.g., "the", "is", "which") filtered out when generating a short title from the question text for the native window title bar. |
| **Auto-split** | When a question exceeds 120 characters with no separate `context`, the first sentence becomes the title and the remainder flows to the context panel. |
| **Select-all option** | A multi-select option whose title matches patterns like "All of the above" or "Select all". Renders as a radio-style toggle that selects all regular options at once. |
| **Additional comments** | A non-toggleable freeform textarea shown at the bottom of every dialog. Users can submit comments without answering the main question. |
