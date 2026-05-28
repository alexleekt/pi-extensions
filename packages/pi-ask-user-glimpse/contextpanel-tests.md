# ContextPanel Unit Tests

## Summary
Created `webview/src/components/__tests__/ContextPanel.test.tsx` with 5 passing tests covering the ContextPanel component, which previously had 0% test coverage.

## Tests

1. **Renders an iframe with srcdoc when context is provided**
   - Verifies `screen.getByTitle("HTML context")` exists and has a `srcDoc` attribute

2. **Renders nothing when context is empty**
   - Verifies iframe is still rendered but the body is empty before the `<script>` tag
   - Checks `srcdoc` contains `<body class="light">\n\n<script>` for empty context

3. **iframe has sandbox attribute for security**
   - Verifies `sandbox="allow-scripts"` is present on the iframe

4. **HTML context is passed directly in srcdoc**
   - Verifies raw HTML content (`<h1>Test HTML</h1>`) appears in the iframe `srcdoc`

5. **Markdown context is rendered to HTML in srcdoc**
   - Verifies the `.markdown-body` div is rendered with parsed HTML content

## Mocks

- `mermaid`: Mocked `initialize` and `run` to avoid actual diagram rendering in jsdom
- `marked`: Mocked `parse` to return predictable HTML (`<h1>` for headings, `<p>` for paragraphs)
- `../util/settings.js`: Mocked `useSettings` to return `{ resolvedTheme: "light" }`
- `../util/pi-charts.js`: Mocked `PI_CHARTS_LIBRARY` to empty string
- `../util/markdown.js`: Mocked `sanitizeHtml` as identity function and `renderMarkdownInline` to return `<span>` wrapper
- `../SettingsButton`: Mocked to a simple placeholder div

## Results

- All 5 tests pass
- Committed as `0cd68b47` with message "deep fixes: add ContextPanel unit tests"
