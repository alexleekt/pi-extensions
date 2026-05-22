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
    <h2>Sample</h2>
    <p>Simple HTML test</p>
</div>`,
    contextFormat: "html" as const,
    options: [
      { title: "OK", description: "Works" },
    ],
    allowMultiple: false,
    allowFreeform: true,
    allowComment: false,
    sessionName: "ping-test",
    theme: "system" as const,
    animationLevel: "all" as const,
  };

  const injected = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  const pingScript = `<script>
    var pingCount = 0;
    function sendPing() {
      pingCount++;
      if (window.glimpse && window.glimpse.send) {
        window.glimpse.send({ type: 'ping', count: pingCount, timestamp: Date.now() });
      }
      if (pingCount < 5) {
        setTimeout(sendPing, 1000);
      }
    }
    setTimeout(sendPing, 500);
  </script>`;

  let html = baseHtml.replace("/*ASK_USER_PAYLOAD*/", injected);
  html = html.replace('<script>\n      window.__ASK_USER_PAYLOAD__', pingScript + '<script>\n      window.__ASK_USER_PAYLOAD__');
  return html;
}

async function main() {
  console.log("[test-ping] Opening...");
  const html = buildHtml();
  const win = open(html, { width: 800, height: 600, title: "Ping Test" });

  win.on("message", (data) => {
    console.log("[test-ping] Message:", JSON.stringify(data));
  });

  await new Promise(r => setTimeout(r, 8000));
  win.close();
  console.log("[test-ping] Done");
}

main().catch(console.error);
