import { chromium } from 'playwright';

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console logs
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[error] ${err.message}`));

  // This mimics what glimpse does: navigate to a data URL containing HTML
  const htmlContent = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Glimpse-like Test</title></head>
<body>
<h1>Glimpse-like Webview</h1>
<div id="status">Waiting...</div>
<iframe id="ctx" sandbox="allow-scripts" srcdoc="<!DOCTYPE html>
<html>
<head><meta charset='utf-8'><style>body { background: #f0f0f0; }</style></head>
<body>
<p id='msg'>Initial</p>
<script>
  window.__messages = [];
  window.addEventListener('message', function(e) {
    window.__messages.push({ type: e.data?.type, origin: e.origin });
    if (e.data?.type === 'theme') {
      document.body.classList.toggle('dark', e.data.theme === 'dark');
      document.getElementById('msg').textContent = 'Theme: ' + e.data.theme;
    }
  });
  // Tell parent we loaded
  window.parent.postMessage({ type: 'loaded' }, '*');
</script>
</body>
</html>"></iframe>
<script>
  window.addEventListener('message', function(e) {
    if (e.data?.type === 'loaded') {
      document.getElementById('status').textContent = 'Iframe loaded (postMessage received)';
    }
  });
</script>
</body>
</html>`;

  const dataUrl = `data:text/html;base64,${Buffer.from(htmlContent).toString('base64')}`;
  await page.goto(dataUrl);

  // Wait for iframe to load
  await page.waitForTimeout(500);

  // Check parent status
  const status = await page.locator('#status').textContent();
  console.log('Parent status:', status);

  // Find iframe frame via page.frames()
  const frames = page.frames();
  console.log('Number of frames:', frames.length);
  const iframeFrame = frames.find(f => f.url() === 'about:srcdoc');
  console.log('Found srcdoc frame:', !!iframeFrame);

  if (iframeFrame) {
    // Check if postMessage was received inside iframe
    const messages = await iframeFrame.evaluate(() => window.__messages);
    console.log('Messages received inside iframe before parent send:', JSON.stringify(messages));

    // Check if DOM was updated by script
    const msgText = await iframeFrame.locator('#msg').textContent();
    console.log('Iframe msg text (script ran?):', msgText);

    // Try sending postMessage from parent to iframe via page.evaluate
    await page.evaluate(() => {
      const iframe = document.getElementById('ctx');
      iframe.contentWindow.postMessage({ type: 'theme', theme: 'dark' }, '*');
    });

    await page.waitForTimeout(200);

    const msgTextAfter = await iframeFrame.locator('#msg').textContent();
    console.log('Iframe msg after parent postMessage:', msgTextAfter);

    // Check messages array again
    const messagesAfter = await iframeFrame.evaluate(() => window.__messages);
    console.log('Messages after parent postMessage:', JSON.stringify(messagesAfter));
  } else {
    console.log('Could not find about:srcdoc frame');
    frames.forEach((f, i) => console.log(`  Frame ${i}: ${f.url()}`));
  }

  // Check if parent can access iframe.contentWindow.document (should fail for cross-origin)
  const accessResult = await page.evaluate(() => {
    const iframe = document.getElementById('ctx');
    try {
      const doc = iframe.contentWindow.document;
      return { accessible: true, title: doc.title };
    } catch (err) {
      return { accessible: false, error: err.message };
    }
  });
  console.log('Parent access to iframe.document:', JSON.stringify(accessResult));

  await page.waitForTimeout(200);
  console.log('\nConsole logs:');
  logs.forEach(l => console.log(l));

  await browser.close();
}

runTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
