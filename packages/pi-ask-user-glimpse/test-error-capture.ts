import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { open } from "glimpseui";

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildHtml(): string {
  const baseHtml = readFileSync(join(__dirname, "dist", "index.html"), "utf-8");

  const payload = {
    type: "single-select" as const,
    question: "Test: HTML Context",
    context: `<div style="text-align:center; padding: 1rem;">
    <h2 style="color: hsl(var(--primary)); margin-bottom: 0.5rem;">Sample Visualization</h2>
    <div class="bar-chart" style="display: flex; gap: 0.5rem; justify-content: center; margin: 1rem 0; align-items: flex-end;">
        <div style="width: 40px; height: 80px; background: hsl(var(--primary)); border-radius: 4px;"></div>
        <div style="width: 40px; height: 120px; background: hsl(var(--destructive)); border-radius: 4px;"></div>
        <div style="width: 40px; height: 60px; background: hsl(var(--muted-foreground)); border-radius: 4px;"></div>
        <div style="width: 40px; height: 100px; background: hsl(200 80% 50%); border-radius: 4px;"></div>
    </div>
    <p style="color: hsl(var(--muted-foreground)); font-size: 0.875rem;">This bar chart uses the wrapper's CSS variables for theme consistency.</p>
    <script>
        document.querySelectorAll('.bar-chart > div').forEach((bar, i) => {
            const target = bar.style.height;
            bar.style.height = '0px';
            bar.style.transition = 'height 0.6s ease ' + (i * 0.1) + 's';
            setTimeout(() => bar.style.height = target, 50);
        });
    </script>
</div>`,
    contextFormat: "html" as const,
    options: [
      { title: "Looks good", description: "HTML renders with theme colors" },
      { title: "Broken", description: "Something is wrong" },
    ],
    allowComment: true,
    allowMultiple: false,
    allowFreeform: true,
    sessionName: "html-test",
    theme: "system" as const,
    animationLevel: "all" as const,
  };

  const injected = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return baseHtml.replace("/*ASK_USER_PAYLOAD*/", injected);
}

async function main() {
  console.log("[test-error-capture] Building HTML...");
  const html = buildHtml();
  console.log("[test-error-capture] Opening window...");
  const win = open(html, { width: 1200, height: 900, title: "Error Capture" });

  const messages: unknown[] = [];

  win.on("message", (data) => {
    console.log("[test-error-capture] Message:", JSON.stringify(data, null, 2));
    messages.push(data);
  });

  win.on("error", (err) => {
    console.error("[test-error-capture] Window error:", err);
  });

  win.on("closed", () => {
    console.log("[test-error-capture] Window closed");
  });

  // Inject global error handler in the webview
  await new Promise(r => setTimeout(r, 2000));
  console.log("[test-error-capture] Injecting error handler...");
  win.send(`
    (function() {
      window.__capturedErrors = [];
      window.addEventListener('error', function(e) {
        window.__capturedErrors.push({
          type: 'error',
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          stack: e.error && e.error.stack ? e.error.stack.substring(0, 500) : null
        });
      });
      window.addEventListener('unhandledrejection', function(e) {
        window.__capturedErrors.push({
          type: 'unhandledrejection',
          message: e.reason && e.reason.message ? e.reason.message : String(e.reason),
          stack: e.reason && e.reason.stack ? e.reason.stack.substring(0, 500) : null
        });
      });
      window.onerror = function(msg, url, line, col, err) {
        window.__capturedErrors.push({
          type: 'onerror',
          message: msg,
          line: line,
          col: col,
          stack: err && err.stack ? err.stack.substring(0, 500) : null
        });
        return false;
      };
      return { injected: true };
    })()
  `);

  // Wait for React to render
  await new Promise(r => setTimeout(r, 3000));

  // Query for errors and error boundary
  console.log("[test-error-capture] Querying DOM state...");
  win.send(`
    (function() {
      const errorBoundary = document.querySelector('.bg-destructive\\/10');
      const hasError = !!errorBoundary;
      const errorText = hasError ? errorBoundary.textContent : null;
      const iframe = document.querySelector('iframe[title="HTML context"]');
      const hasIframe = !!iframe;
      const iframeRect = iframe ? iframe.getBoundingClientRect() : null;

      window.glimpse.send({
        type: 'dom-report',
        hasError,
        errorText: errorText ? errorText.substring(0, 300) : null,
        hasIframe,
        iframeRect: iframeRect ? { width: iframeRect.width, height: iframeRect.height } : null,
        capturedErrors: window.__capturedErrors || [],
        timestamp: Date.now()
      });
    })()
  `);

  await new Promise(r => setTimeout(r, 3000));
  console.log("[test-error-capture] Closing window...");
  win.close();

  console.log("\n=== FINAL REPORT ===");
  console.log("Messages received:", messages.length);
  messages.forEach((m, i) => {
    console.log(`Message ${i}:`, JSON.stringify(m, null, 2));
  });
}

main().catch(err => {
  console.error("[test-error-capture] Fatal error:", err);
  process.exit(1);
});
