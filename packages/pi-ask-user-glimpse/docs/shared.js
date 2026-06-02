// Shared utilities for dynamic markdown loading and rendering
const docs = {
  async loadMarkdown(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
    return response.text();
  },

  // Simple markdown to HTML parser (faster than marked for our use case)
  parseMarkdown(md) {
    let html = md;
    
    // Headers
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    
    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold/italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline">$1</a>');
    
    // Lists
    html = html.replace(/^\s*-\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.+<\/li>\n)+/g, '<ul>$&</ul>');
    
    // Tables
    const tableRegex = /\|([^\n]+)\|\n\|[-:\s|]+\|\n((?:\|[^\n]+\|\n)+)/g;
    html = html.replace(tableRegex, (match, header, rows) => {
      const headers = header.split('|').filter(h => h.trim()).map(h => `<th>${h.trim()}</th>`).join('');
      const rowHtml = rows.split('\n').filter(r => r.trim()).map(row => {
        const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table class="w-full border-collapse"><thead><tr>${headers}</tr></thead><tbody>${rowHtml}</tbody></table>`;
    });
    
    // Blockquotes
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-primary pl-4 italic">$1</blockquote>');
    
    // Horizontal rules
    html = html.replace(/^---\s*$/gm, '<hr class="my-8 border-gray-200 dark:border-gray-700">');
    
    // Paragraphs
    html = html.replace(/\n\n(.+?)\n\n/g, '<p>$1</p>');
    
    return html;
  },

  // Extract structured data from ROADMAP.md
  parseRoadmap(md) {
    const sections = {};
    const lines = md.split('\n');
    let currentSection = null;
    let currentIssue = null;
    
    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '').trim();
        sections[currentSection] = [];
        currentIssue = null;
      } else if (line.startsWith('### ') && currentSection) {
        currentIssue = {
          title: line.replace('### ', '').trim(),
          details: [],
          severity: null,
          status: null,
          file: null
        };
        sections[currentSection].push(currentIssue);
      } else if (currentIssue && line.startsWith('- ')) {
        const text = line.replace('- ', '').trim();
        if (text.includes('**Severity:**')) {
          currentIssue.severity = text.replace('**Severity:**', '').trim();
        } else if (text.includes('**Status:**')) {
          currentIssue.status = text.replace('**Status:**', '').trim();
        } else if (text.includes('**File:**')) {
          currentIssue.file = text.replace('**File:**', '').trim();
        } else {
          currentIssue.details.push(text);
        }
      }
    }
    
    return sections;
  },

  // Extract structured data from CONTEXT.md
  parseContext(md) {
    const sections = {};
    const lines = md.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '').trim();
        sections[currentSection] = [];
      } else if (line.startsWith('|') && currentSection && !line.includes('---')) {
        const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
        if (cells.length >= 2 && cells[0] !== 'Term' && cells[0] !== 'Type') {
          sections[currentSection].push({
            term: cells[0],
            definition: cells[1]
          });
        }
      }
    }
    
    return sections;
  },

  // Theme toggle
  initTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
    return {
      toggle: () => document.documentElement.classList.toggle('dark'),
      isDark: () => document.documentElement.classList.contains('dark')
    };
  }
};

// Make available globally
window.docs = docs;
