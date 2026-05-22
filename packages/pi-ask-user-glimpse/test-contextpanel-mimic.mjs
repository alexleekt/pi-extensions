import { chromium } from 'playwright';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[error] ${err.message}`));

  // Build HTML that exactly mimics ContextPanel.tsx's HtmlContext + the surrounding page
  const parentHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ContextPanel Mimic</title>
<style>
body { margin: 0; font-family: sans-serif; }
.container { width: 600px; height: 400px; }
iframe { width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>
<div class="container">
  <iframe id="ctx" loading="lazy" sandbox="allow-scripts" srcdoc="<!DOCTYPE html>
<html>
<head><meta charset='utf-8'>
<style>
:root { --bg: #fff; --fg: #000; }
.dark { --bg: #222; --fg: #fff; }
body { background: var(--bg); color: var(--fg); margin: 0; padding: 1rem; }
</style>
</head>
<body>
<p id='msg'>Waiting for theme...</p>
<script>
  window.__themeReceived = null;
  window.addEventListener('message', function(e) {
    if (e.data?.type === 'theme') {
      window.__themeReceived = e.data.theme;
      document.body.classList.toggle('dark', e.data.theme === 'dark');
      document.getElementById('msg').textContent = 'Theme received: ' + e.data.theme;
    }
  });
  document.getElementById('msg').textContent = 'Script loaded, waiting for postMessage';
</script>
</body>
</html>"></iframe>
</div>
<script>
  const iframe = document.getElementById('ctx');
  let loaded = false;
  
  function sendTheme(theme) {
    if (!loaded) { console.log('Not loaded yet, cannot send theme'); return; }
    const cw = iframe.contentWindow;
    if (!cw) { console.log('No contentWindow'); return; }
    cw.postMessage({ type: 'theme', theme: theme }, '*');
    console.log('Sent theme:', theme);
  }
  
  iframe.addEventListener('load', function() {
    loaded = true;
    console.log('Iframe onLoad fired');
    sendTheme('dark');
  });
  
  // Also try immediately (may fail if not loaded yet)
  setTimeout(() => sendTheme('light'), 100);
  setTimeout(() => sendTheme('dark'), 300);
</script>
</body>
</html>`;

  const dataUrl = `data:text/html;base64,${Buffer.from(parentHtml).toString('base64')}`;
  await page.goto(dataUrl);

  await page.waitForTimeout(1000);

  // Get iframe frame
  const frames = page.frames();
  const iframeFrame = frames.find(f => f.url() === 'about:srcdoc');
  console.log('Found srcdoc frame:', !!iframeFrame);

  if (iframeFrame) {
    const msgText = await iframeFrame.locator('#msg').textContent();
    console.log('Iframe msg:', msgText);
    const themeReceived = await iframeFrame.evaluate(() => window.__themeReceived);
    console.log('Theme received:', themeReceived);
  }

  console.log('\nConsole logs:');
  logs.forEach(l => console.log(l));

  await browser.close();
}

runTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
