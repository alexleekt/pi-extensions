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

  const errorCapture = `<script>
    window.__capturedErrors = [];
    window.addEventListener('error', function(e) {
      window.__capturedErrors.push({
        type: 'error',
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
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
    function sendReport() {
      var errorBoundary = document.querySelector('[class*="bg-destructive"]');
      var hasError = !!errorBoundary;
      var errorText = hasError ? errorBoundary.textContent : null;
      if (window.glimpse && window.glimpse.send) {
        window.glimpse.send({
          type: 'error-report',
          hasError: hasError,
          errorText: errorText ? errorText.substring(0, 300) : null,
          capturedErrors: window.__capturedErrors,
          bodyHTML: document.body.innerHTML.substring(0, 200),
          timestamp: Date.now()
        });
      }
    }
    setTimeout(sendReport, 500);
    setTimeout(sendReport, 2000);
    setTimeout(sendReport, 5000);
  </script>`;

  let html = baseHtml.replace("/*ASK_USER_PAYLOAD*/", injected);
  html = html.replace('<script>\n      window.__ASK_USER_PAYLOAD__', errorCapture + '<script>\n      window.__ASK_USER_PAYLOAD__');
  return html;
}

async function main() {
  console.log("[test-error-capture2] Opening...");
  const html = buildHtml();
  const win = open(html, { width: 1200, height: 900, title: "Error Capture 2" });

  win.on("message", (data) => {
    console.log("[test-error-capture2] Message:", JSON.stringify(data, null, 2));
  });

  await new Promise(r => setTimeout(r, 8000));
  win.close();
  console.log("[test-error-capture2] Done");
}

main().catch(console.error);
