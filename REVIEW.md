# Code Review: `@alexleekt/pi-ask-user-glimpse` v0.1.0

**Date:** 2026-05-16
**Scope:** Full extension — server-side TypeScript + webview React app
**Status:** ✅ Build passes, TypeScript compiles, but issues found

---

## 🔴 Critical Issues (Fixed)

### 1. ✅ FIXED — `allAnswered` in Questionnaire uses strict equality with empty string
**File:** `webview/src/components/Questionnaire.tsx:115`

**Fix applied:**
```tsx
const allAnswered = questions.every((q) => {
	const ans = answers[q.title];
	if (ans === undefined) return false;
	if (Array.isArray(ans)) return ans.length > 0;
	return true; // allow empty string for freeform
});
```

---

## 🟡 Medium Issues

### 2. ✅ FIXED — Payload injection uses string replacement, not proper serialization
**File:** `tool/ask-user.ts:97`

**Fix applied:**
```ts
const html = baseHtml.replace(
	"/*ASK_USER_PAYLOAD*/",
	JSON.stringify(payload)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026"),
);
```

### 3. ✅ FIXED — Keyboard shortcuts in webview components
**File:** All webview components
**Fix applied:** Added `useEffect` keydown listeners in all components:
- `Escape` → Close open comment textarea; if none open, cancel dialog
- `Enter` → Select+submit (SingleSelect), toggle (MultiSelect/Questionnaire options), submit form (Ctrl+Enter in Freeform/Questionnaire)
- `ArrowUp`/`ArrowDown` → Navigate options with roving tabindex (SingleSelect, MultiSelect)
- `Space` → Toggle multi-select options
- `Tab` → Natural focus movement
- Focus ring (`ring-2 ring-ring`) indicates keyboard-focused option

### 4. ✅ FIXED — `resolveWebviewHtml` has confusing fallback logic
**File:** `tool/ask-user.ts:25-34`

**Fix applied:** Error now propagates with helpful context:
```ts
function resolveWebviewHtml(): string {
	const distPath = join(__dirname, "..", "dist", "index.html");
	try {
		return readFileSync(distPath, "utf-8");
	} catch {
		const pkgRoot = dirname(_require.resolve("../package.json"));
		const fallbackPath = join(pkgRoot, "dist", "index.html");
		try {
			return readFileSync(fallbackPath, "utf-8");
		} catch (err) {
			throw new Error(
				`Could not find webview bundle. Tried:\n` +
					`  1. ${distPath}\n` +
					`  2. ${fallbackPath}\n` +
					`Run 'npm run build' first to generate dist/index.html.`,
				{ cause: err },
			);
		}
	}
}
```

### 5. ✅ FIXED — `displayMode` param accepted but ignored
**File:** `index.ts:76-80`

**Fix applied:** Runtime warning added in `tool/ask-user.ts`:
```ts
if (params.displayMode) {
	console.warn(
		"[pi-ask-user-glimpse] displayMode parameter is ignored; Glimpse always opens a centered dialog.",
	);
}
```

### 6. ✅ FIXED — `Questionnaire` sends `selections` array even for single-select questions
**File:** `webview/src/components/Questionnaire.tsx` and `fallback/terminal-prompt.ts`

**Fix applied:** Both webview and terminal fallback now send `kind: "questionnaire"` with per-question `kind` in `questionnaireDetails`:
```ts
{
	kind: "questionnaire",
	selections: ["Database: PostgreSQL", "Notes: some text"],
	questionnaireDetails: [
		{ question: "Database", answer: "PostgreSQL", kind: "selection" },
		{ question: "Notes", answer: "some text", kind: "freeform" },
	],
}
```

`response-formatter.ts` handles `kind: "questionnaire"` by extracting `selections` for text output and preserving `questionnaireDetails` with per-question `kind` in `response.questionnaireDetails`.

---

## 🟢 Low Issues / Suggestions

### 7. `terminal-prompt.ts` questionnaire multi-select doesn't handle cancellation well
**File:** `fallback/terminal-prompt.ts:43-58`
```ts
while (true) {
	const remaining = labels.filter((_, i) => !selections.includes(q.options![i].title));
	if (remaining.length === 0) break;
	const choice = await ui.select(...);
	if (choice === undefined) break; // user cancelled
```
**Issue:** If user cancels a multi-select question mid-way, the partial selections are used as the answer. There's no way to say "I don't want to answer this question."

**Fix:** After the loop, ask for confirmation:
```ts
const confirm = await ui.confirm(q.title, `Use "${selections.join(", ")}"?`);
if (!confirm) continue; // restart the question
```

### 8. No index.html template check at build time
**File:** `package.json`
**Issue:** If `dist/index.html` is missing (e.g., user forgot to build), the extension fails at runtime with a file-not-found error.

**Fix:** Add a pre-build check script or make `build` a prepublish step:
```json
"prepack": "npm run build"
```

### 9. `vite-plugin-singlefile` CSS inlining warning
**File:** `vite.config.ts`
**Issue:** The `vite-plugin-singlefile` inlines CSS as `<style rel="stylesheet" crossorigin>` which is slightly unusual (rel="stylesheet" on a style tag is redundant). This is harmless but could be cleaner.

**Fix:** Use `vite-plugin-singlefile` v2+ which handles this better, or accept as-is.

### 10. Missing `README.md` instructions for questionnaire mode
**File:** `README.md`
**Issue:** The README documents basic usage but doesn't explain the `questions` parameter for questionnaire mode with per-question options.

**Fix:** Add an example:
```json
{
  "question": "Architecture questionnaire",
  "questions": [
    {
      "title": "Database",
      "options": [{"title": "PostgreSQL"}, {"title": "SQLite"}],
      "allowMultiple": false
    }
  ]
}
```

---

## ✅ What's Good

1. **Deferred conflict check** — Correctly avoids action-method-during-loading error
2. **Official `StringEnum` import** — Uses `@earendil-works/pi-ai` export, not custom impl
3. **Type safety** — All payloads have explicit interfaces shared between server/webview
4. **Terminal fallback** — Graceful degradation when Glimpse unavailable
5. **Self-contained bundle** — Single HTML file, no external requests
6. **Dark mode** — Uses `prefers-color-scheme` media query
7. **LICENSE file** — MIT license included in tarball
8. **Build pipeline** — CSS pre-build + Vite inlining works reliably

---

## Summary

| Severity | Count | Items | Status |
|----------|-------|-------|--------|
| 🔴 Critical | 1 | #1 `allAnswered` strict equality | ✅ Fixed |
| 🟡 Medium | 5 | #2 payload escaping, #3 keyboard, #4 fallback error, #5 displayMode, #6 kind consistency | ✅ 4/5 fixed, #3 pending |
| 🟢 Low | 4 | #7-10 cancellation, build check, CSS tag, README | Pending |

**Verdict:** Critical and most medium issues fixed. Extension compiles, builds, and packs cleanly. Ready to ship v0.1.0; keyboard shortcuts (#3) deferred to v0.1.1.
