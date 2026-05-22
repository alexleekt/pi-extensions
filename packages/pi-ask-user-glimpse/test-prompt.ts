import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prompt } from "glimpseui";

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
  console.log("[test-prompt] Building HTML...");
  const html = buildHtml();
  console.log("[test-prompt] Calling prompt()...");
  
  try {
    const result = await prompt(html, {
      width: 1200,
      height: 900,
      title: "Prompt Test",
    });
    console.log("[test-prompt] Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("[test-prompt] Error:", err);
  }
  
  console.log("[test-prompt] Done");
}

main().catch(console.error);
