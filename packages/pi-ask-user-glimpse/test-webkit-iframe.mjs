import { webkit, chromium } from 'playwright';

async function testBrowser(browserType, name) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[error] ${err.message}`));

  // Exact mimic of ContextPanel.tsx buildIframeSrcdoc
  const IFRAME_CSS_VARS = `
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
  `;
  const IFRAME_CSS_VARS_DARK = `
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
  `;
  const IFRAME_CSS = `body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: ui-sans-serif, system-ui, sans-serif;
    margin: 0; padding: 1rem; line-height: 1.6;
  }`;
  const IFRAME_SCRIPT = `window.addEventListener("message", function(e) {
    if (e.data?.type === "theme") {
      document.body.classList.toggle("dark", e.data.theme === "dark");
      document.getElementById("status").textContent = "Theme: " + e.data.theme;
    }
  });`;

  function buildIframeSrcdoc(rawHtml, theme) {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
:root { ${IFRAME_CSS_VARS} }
.dark { ${IFRAME_CSS_VARS_DARK} }
${IFRAME_CSS}
</style>
</head>
<body class="${theme}">
${rawHtml}
<script>
${IFRAME_SCRIPT}
</script>
</body>
</html>`;
  }

  const rawHtml = `<h1>Test HTML Context</h1><p id="status">Waiting for theme...</p>`;
  const srcdoc = buildIframeSrcdoc(rawHtml, 'light');

  const parentHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test - ${name}</title>
<style>body { margin: 0; } iframe { width: 100%; height: 100%; border: 0; }</style>
</head>
<body>
<div style="width: 500px; height: 300px;">
<iframe id="ctx" loading="lazy" sandbox="allow-scripts" srcdoc="${srcdoc.replace(/"/g, '&quot;')}"></iframe>
</div>
<script>
  const iframe = document.getElementById('ctx');
  let loaded = false;
  iframe.addEventListener('load', function() {
    loaded = true;
    console.log('iframe onLoad fired');
    iframe.contentWindow.postMessage({ type: 'theme', theme: 'dark' }, '*');
  });
  setTimeout(function() {
    if (!loaded) console.log('WARNING: onLoad did not fire within 500ms');
  }, 500);
</script>
</body>
</html>`;

  const dataUrl = `data:text/html;base64,${Buffer.from(parentHtml).toString('base64')}`;
  await page.goto(dataUrl);
  await page.waitForTimeout(800);

  // Find srcdoc frame
  const frames = page.frames();
  const srcdocFrame = frames.find(f => f.url() === 'about:srcdoc');

  console.log(`\n=== ${name} ===`);
  console.log('Found about:srcdoc frame:', !!srcdocFrame);

  if (srcdocFrame) {
    try {
      const statusText = await srcdocFrame.locator('#status').textContent();
      console.log('Iframe status text:', statusText);
    } catch (err) {
      console.log('Could not read iframe status:', err.message);
    }
  }

  console.log('Console logs:');
  logs.forEach(l => console.log(' ', l));

  await browser.close();
}

(async () => {
  await testBrowser(chromium, 'Chromium');
  await testBrowser(webkit, 'WebKit');
})();
