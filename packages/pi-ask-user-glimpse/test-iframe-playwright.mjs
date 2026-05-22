import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Load the test HTML file
  const testPath = join(__dirname, 'test-iframe-srcdoc.html');
  await page.goto(`file://${testPath}`);

  // Wait for results to populate
  await page.waitForTimeout(1000);

  // Extract results
  const results = await page.evaluate(() => {
    const divs = document.querySelectorAll('#results > div');
    return Array.from(divs).map(d => ({
      pass: d.className === 'pass',
      text: d.textContent,
    }));
  });

  console.log('=== Test Results ===');
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}: ${r.text}`);
  }

  // Also test: can we postMessage to a sandboxed srcdoc iframe from parent?
  console.log('\n=== Direct postMessage Test ===');
  const iframeHandles = await page.locator('iframe').all();
  for (let i = 0; i < iframeHandles.length; i++) {
    const iframe = iframeHandles[i];
    try {
      // Evaluate inside the iframe to check if postMessage was received
      const received = await iframe.evaluate(() => {
        return window.__testMessagesReceived || 0;
      });
      console.log(`iframe[${i}] postMessage received count: ${received}`);
    } catch (err) {
      console.log(`iframe[${i}] error accessing contentWindow: ${err.message}`);
    }
  }

  await browser.close();
}

runTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
