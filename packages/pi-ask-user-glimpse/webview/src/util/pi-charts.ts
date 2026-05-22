/**
 * Micro visualization library injected into every HTML context iframe.
 *
 * Exposes `window.pi` with helpers for common agent-generated visualizations:
 * bar charts, pie charts, tables, pros/cons, timelines, and metric cards.
 *
 * All helpers read CSS custom properties (--primary, --foreground, etc.)
 * from the wrapper's theme so they automatically match light/dark mode.
 *
 * This is deliberately plain JS (no TS runtime features) so it runs
 * directly inside the sandboxed iframe without compilation.
 */

export const PI_CHARTS_LIBRARY = `
(function(global) {
  "use strict";

  /* ── Theme helpers ── */
  function cssVar(name, fallback) {
    try {
      const val = getComputedStyle(document.body).getPropertyValue(name).trim();
      return val || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function themeColor(name, fallback) {
    const val = cssVar(name, fallback);
    // If the variable is stored as HSL (e.g. "240 10% 3.9%"), wrap it.
    if (val && !val.startsWith("hsl") && !val.startsWith("#") && !val.startsWith("rgb")) {
      return "hsl(" + val + ")";
    }
    return val;
  }

  /* ── Palette ──
   * Chosen for visibility on both light and dark backgrounds.
   * Rose replaced with coral (brighter, more distinct in dark mode). */
  const COLORS = [
    "hsl(210 100% 56%)",   // blue
    "hsl(160 84% 39%)",    // emerald
    "hsl(25 95% 53%)",     // orange
    "hsl(350 90% 65%)",    // coral (was rose)
    "hsl(270 50% 60%)",    // purple
    "hsl(48 96% 53%)",     // yellow
    "hsl(190 90% 50%)",    // cyan
    "hsl(0 0% 60%)",       // gray
  ];

  function getColor(i, override) {
    return override || COLORS[i % COLORS.length];
  }

  function resolveEl(selector) {
    if (typeof selector === "string") {
      const el = document.querySelector(selector);
      if (!el) throw new Error("pi: no element matches " + selector);
      return el;
    }
    if (selector && selector.nodeType) return selector;
    throw new Error("pi: invalid selector");
  }

  function clear(el) {
    el.innerHTML = "";
  }

  /* ── Card wrapper ──
   * Wraps any visualization in a bordered card container for visual separation.
   * Uses --card background and --border for the outline. */
  function cardWrap(content) {
    const wrap = document.createElement("div");
    const border = themeColor("--border", "#e5e5e5");
    const bg = themeColor("--card", "#fff");
    wrap.style.cssText = "border:1px solid " + border + ";border-radius:12px;padding:1rem;background:" + bg + ";margin-bottom:1rem;";
    if (typeof content === "string") {
      wrap.innerHTML = content;
    } else if (content && content.nodeType) {
      wrap.appendChild(content);
    }
    return wrap;
  }

  function setTitle(el, title) {
    if (!title) return;
    const h3 = document.createElement("h3");
    h3.textContent = title;
    h3.style.cssText = "margin:0 0 0.75rem 0;font-size:1rem;font-weight:600;color:" + themeColor("--foreground", "#000") + ";";
    el.appendChild(h3);
  }

  /* ── Detect dark mode ── */
  function isDarkMode() {
    // Check if body has .dark class (set by theme propagation)
    if (document.body.classList.contains("dark")) return true;
    const bg = themeColor("--background", "#fff");
    // Heuristic: if background is very dark, we're in dark mode
    const rgb = bg.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
      return brightness < 80;
    }
    return false;
  }

  /* Bright red that works in both light and dark mode for badges/markers */
  function brightRed() {
    return "hsl(0 80% 60%)";
  }

  /* Badge/pill helper for status indicators that must be readable in both themes */
  function badge(text, bgColor, textColor) {
    const span = document.createElement("span");
    span.textContent = text;
    span.style.cssText = "display:inline-block;padding:0.125rem 0.375rem;border-radius:9999px;font-size:0.6875rem;font-weight:600;line-height:1;";
    span.style.backgroundColor = bgColor;
    span.style.color = textColor;
    return span;
  }

  /* ── 1. Bar Chart ── */
  function barChart(selector, data, opts) {
    opts = opts || {};
    const el = resolveEl(selector);
    clear(el);

    const width = opts.width || 400;
    const height = opts.height || 240;
    const pad = { top: 10, right: 10, bottom: 28, left: 36 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    const max = opts.maxValue || Math.max.apply(null, data.map(function(d) { return d.value; }));
    const count = data.length;
    const barGap = opts.barSpacing != null ? opts.barSpacing : 4;
    const barW = (chartW - barGap * (count - 1)) / count;

    const card = cardWrap();
    setTitle(card, opts.title);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.style.display = "block";

    const fg = themeColor("--foreground", "#111");
    const muted = themeColor("--muted-foreground", "#888");
    const border = themeColor("--border", "#ddd");

    // Grid lines
    const gridCount = 5;
    for (let i = 0; i <= gridCount; i++) {
      const y = pad.top + chartH - (i / gridCount) * chartH;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", pad.left);
      line.setAttribute("y1", y);
      line.setAttribute("x2", width - pad.right);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", border);
      line.setAttribute("stroke-width", "1");
      if (i > 0) line.setAttribute("stroke-dasharray", "2,2");
      svg.appendChild(line);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", pad.left - 6);
      text.setAttribute("y", y + 4);
      text.setAttribute("text-anchor", "end");
      text.setAttribute("font-size", "10");
      text.setAttribute("fill", muted);
      text.textContent = Math.round((i / gridCount) * max);
      svg.appendChild(text);
    }

    data.forEach(function(d, i) {
      const h = (d.value / max) * chartH;
      const x = pad.left + i * (barW + barGap);
      const y = pad.top + chartH - h;
      const color = getColor(i, d.color);
      const isHighlighted = opts.highlightIndex === i;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width", Math.max(barW, 1));
      rect.setAttribute("height", h);
      rect.setAttribute("fill", color);
      rect.setAttribute("rx", 3);
      if (isHighlighted) {
        rect.setAttribute("stroke", fg);
        rect.setAttribute("stroke-width", "2");
      }
      svg.appendChild(rect);

      if (opts.showValues !== false) {
        const valText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        valText.setAttribute("x", x + barW / 2);
        valText.setAttribute("y", y - 4);
        valText.setAttribute("text-anchor", "middle");
        valText.setAttribute("font-size", "10");
        valText.setAttribute("fill", fg);
        valText.setAttribute("font-weight", "600");
        valText.textContent = d.value;
        svg.appendChild(valText);
      }

      if (opts.showLabels !== false) {
        const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
        lbl.setAttribute("x", x + barW / 2);
        lbl.setAttribute("y", height - 6);
        lbl.setAttribute("text-anchor", "middle");
        lbl.setAttribute("font-size", "10");
        lbl.setAttribute("fill", muted);
        lbl.textContent = d.label;
        svg.appendChild(lbl);
      }
    });

    card.appendChild(svg);
    el.appendChild(card);
  }

  /* ── 2. Pie / Donut Chart ── */
  function pieChart(selector, data, opts) {
    opts = opts || {};
    const el = resolveEl(selector);
    clear(el);

    const size = opts.size || 200;
    const donut = opts.donut !== false;
    const radius = size / 2;
    const inner = donut ? radius * 0.55 : 0;
    const cx = radius;
    const cy = radius;
    const total = data.reduce(function(s, d) { return s + d.value; }, 0);

    const card = cardWrap();
    setTitle(card, opts.title);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.style.display = "block";

    let angle = -Math.PI / 2;
    data.forEach(function(d, i) {
      const slice = (d.value / total) * 2 * Math.PI;
      const a1 = angle;
      const a2 = angle + slice;
      const x1 = cx + radius * Math.cos(a1);
      const y1 = cy + radius * Math.sin(a1);
      const x2 = cx + radius * Math.cos(a2);
      const y2 = cy + radius * Math.sin(a2);
      const xi = cx + inner * Math.cos(a1);
      const yi = cy + inner * Math.sin(a1);
      const xo = cx + inner * Math.cos(a2);
      const yo = cy + inner * Math.sin(a2);
      const large = slice > Math.PI ? 1 : 0;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const dpath = "M" + x1 + "," + y1 + " A" + radius + "," + radius + " 0 " + large + ",1 " + x2 + "," + y2;
      const dpathInner = donut ? (" L" + xo + "," + yo + " A" + inner + "," + inner + " 0 " + large + ",0 " + xi + "," + yi + " Z") : " Z";
      path.setAttribute("d", dpath + dpathInner);
      path.setAttribute("fill", getColor(i, d.color));
      path.setAttribute("stroke", themeColor("--card", "#fff"));
      path.setAttribute("stroke-width", "2");
      svg.appendChild(path);

      angle += slice;
    });

    card.appendChild(svg);

    if (opts.showLegend !== false) {
      const legend = document.createElement("div");
      legend.style.cssText = "display:flex;flex-wrap:wrap;gap:0.5rem 1rem;margin-top:0.5rem;justify-content:center;";
      data.forEach(function(d, i) {
        const item = document.createElement("div");
        item.style.cssText = "display:flex;align-items:center;gap:0.35rem;font-size:0.75rem;";
        const dot = document.createElement("span");
        dot.style.cssText = "width:8px;height:8px;border-radius:50%;display:inline-block;";
        dot.style.backgroundColor = getColor(i, d.color);
        item.appendChild(dot);
        const lbl = document.createElement("span");
        lbl.style.color = themeColor("--foreground", "#111");
        lbl.style.opacity = "0.75";
        lbl.textContent = d.label + (opts.showValues !== false ? " (" + d.value + ")" : "");
        item.appendChild(lbl);
        legend.appendChild(item);
      });
      card.appendChild(legend);
    }

    el.appendChild(card);
  }

  /* ── 3. Table ── */
  function table(selector, headers, rows, opts) {
    opts = opts || {};
    const el = resolveEl(selector);
    clear(el);

    const fg = themeColor("--foreground", "#111");
    const muted = themeColor("--muted-foreground", "#888");
    const border = themeColor("--border", "#e5e5e5");
    const bg = themeColor("--card", "#fff");
    const cardBg = themeColor("--card", "#fff");
    const primary = themeColor("--primary", "#333");

    const card = cardWrap();
    setTitle(card, opts.title || opts.caption);

    const tbl = document.createElement("table");
    tbl.style.cssText = "width:100%;border-collapse:collapse;font-size:0.875rem;line-height:1.5;";

    const thead = document.createElement("thead");
    const hRow = document.createElement("tr");
    headers.forEach(function(h, i) {
      const th = document.createElement("th");
      th.textContent = h;
      th.style.cssText = "text-align:left;padding:0.5rem;border-bottom:2px solid " + border + ";font-weight:600;color:" + fg + ";white-space:nowrap;";
      if (opts.align && opts.align[i]) th.style.textAlign = opts.align[i];
      if (opts.highlightColumn === i) {
        const hlOpacity = isDarkMode() ? "0.25" : "0.12";
        th.style.backgroundColor = "hsla(" + cssVar("--primary", "240 5.9% 10%") + "," + hlOpacity + ")";
        th.style.color = primary;
      }
      hRow.appendChild(th);
    });
    thead.appendChild(hRow);
    tbl.appendChild(thead);

    const tbody = document.createElement("tbody");
    const highlightRows = ([]).concat(opts.highlightRow != null ? opts.highlightRow : []);
    rows.forEach(function(row, ri) {
      const tr = document.createElement("tr");
      const isStriped = opts.striped && ri % 2 === 1;
      const isHighlighted = highlightRows.indexOf(ri) !== -1;
      const dark = isDarkMode();
      let rowBg = isStriped ? "hsla(" + cssVar("--foreground", "240 10% 3.9%") + ",0.04)" : bg;
      if (isHighlighted) rowBg = "hsla(" + cssVar("--primary", "240 5.9% 10%") + "," + (dark ? "0.25" : "0.12") + ")";
      tr.style.backgroundColor = rowBg;

      row.forEach(function(cell, ci) {
        const td = document.createElement("td");
        td.textContent = cell;
        td.style.cssText = "padding:0.5rem;border-bottom:1px solid " + border + ";color:" + (ci === 0 ? fg : muted) + ";";
        if (opts.align && opts.align[ci]) td.style.textAlign = opts.align[ci];
        if (opts.highlightColumn === ci) {
          const hlOpacity = isDarkMode() ? "0.25" : "0.12";
          td.style.backgroundColor = "hsla(" + cssVar("--primary", "240 5.9% 10%") + "," + hlOpacity + ")";
          td.style.color = primary;
          td.style.fontWeight = "500";
        }
        if (opts.compact) td.style.padding = "0.35rem 0.5rem";
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);

    card.appendChild(tbl);
    el.appendChild(card);
  }

  /* ── 4. Pros & Cons ── */
  function prosCons(selector, pros, cons, opts) {
    opts = opts || {};
    const el = resolveEl(selector);
    clear(el);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:1rem;";

    const fg = themeColor("--foreground", "#111");
    const muted = themeColor("--muted-foreground", "#888");
    const border = themeColor("--border", "#e5e5e5");
    const primary = themeColor("--primary", "#333");
    const primaryFg = themeColor("--primary-foreground", "#fff");
    const red = brightRed();

    function column(title, items, isPros) {
      const col = document.createElement("div");
      col.style.cssText = "border:1px solid " + border + ";border-radius:8px;padding:0.75rem;background:" + themeColor("--card", "#fff") + ";";

      const header = document.createElement("div");
      header.style.cssText = "margin:0 0 0.5rem 0;display:flex;align-items:center;gap:0.5rem;";
      const pill = badge(
        title,
        isPros ? "hsl(160 84% 39%)" : red,
        "#fff"
      );
      pill.style.fontSize = "0.75rem";
      pill.style.padding = "0.2rem 0.5rem";
      header.appendChild(pill);
      col.appendChild(header);

      const ul = document.createElement("ul");
      ul.style.cssText = "margin:0;padding-left:1.25rem;list-style:none;";
      items.forEach(function(item) {
        const li = document.createElement("li");
        li.style.cssText = "margin-bottom:0.35rem;font-size:0.8125rem;color:" + muted + ";position:relative;padding-left:1.25rem;";
        // Use small filled circle markers with white symbols for visibility
        // Pros = green (emerald), Cons = red for clear good/bad semantics
        const markerBg = isPros ? "hsl(160 84% 39%)" : red;
        const markerSym = isPros ? "+" : "−";
        li.innerHTML = '<span style="position:absolute;left:0;top:0.15rem;width:14px;height:14px;border-radius:50%;background:' + markerBg + ';color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:0.625rem;font-weight:700;line-height:1;">' + markerSym + '</span> ' + item;
        ul.appendChild(li);
      });
      col.appendChild(ul);
      return col;
    }

    setTitle(el, opts.title);
    wrap.appendChild(column(opts.prosTitle || "Pros", pros, true));
    wrap.appendChild(column(opts.consTitle || "Cons", cons, false));
    el.appendChild(wrap);
  }

  /* ── 5. Timeline ── */
  function timeline(selector, events, opts) {
    opts = opts || {};
    const el = resolveEl(selector);
    clear(el);

    const fg = themeColor("--foreground", "#111");
    const muted = themeColor("--muted-foreground", "#888");
    const border = themeColor("--border", "#e5e5e5");
    const primary = themeColor("--primary", "#333");

    const card = cardWrap();
    setTitle(card, opts.title);

    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;gap:0;position:relative;padding-top:0.5rem;";

    // Connector line
    const line = document.createElement("div");
    line.style.cssText = "position:absolute;top:1.25rem;left:0;right:0;height:2px;background:" + border + ";z-index:0;";
    wrap.appendChild(line);

    events.forEach(function(ev, i) {
      const step = document.createElement("div");
      step.style.cssText = "flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;z-index:1;min-width:0;";

      const dotColor = ev.status === "complete" ? primary : (ev.status === "current" ? themeColor("--secondary-foreground", "#666") : border);
      const fillColor = ev.status === "complete" ? primary : (ev.status === "current" ? themeColor("--card", "#fff") : "transparent");

      const dot = document.createElement("div");
      dot.style.cssText = "width:12px;height:12px;border-radius:50%;border:2px solid " + dotColor + ";background:" + fillColor + ";margin-bottom:0.5rem;flex-shrink:0;";
      step.appendChild(dot);

      const date = document.createElement("div");
      date.textContent = ev.date;
      date.style.cssText = "font-size:0.6875rem;color:" + muted + ";margin-bottom:0.15rem;white-space:nowrap;";
      step.appendChild(date);

      const title = document.createElement("div");
      title.textContent = ev.title;
      title.style.cssText = "font-size:0.75rem;font-weight:600;color:" + fg + ";line-height:1.3;";
      step.appendChild(title);

      if (ev.description) {
        const desc = document.createElement("div");
        desc.textContent = ev.description;
        desc.style.cssText = "font-size:0.6875rem;color:" + muted + ";margin-top:0.15rem;line-height:1.3;";
        step.appendChild(desc);
      }

      wrap.appendChild(step);
    });

    card.appendChild(wrap);
    el.appendChild(card);
  }

  /* ── 6. Metrics Cards ── */
  function metrics(selector, cards, opts) {
    opts = opts || {};
    const el = resolveEl(selector);
    clear(el);
    setTitle(el, opts.title);

    const fg = themeColor("--foreground", "#111");
    const muted = themeColor("--muted-foreground", "#888");
    const border = themeColor("--border", "#e5e5e5");
    const cardBg = themeColor("--card", "#fff");
    const primary = themeColor("--primary", "#333");
    const primaryFg = themeColor("--primary-foreground", "#fff");
    const red = brightRed();

    const grid = document.createElement("div");
    const cols = opts.columns || Math.min(cards.length, 3);
    grid.style.cssText = "display:grid;grid-template-columns:repeat(" + cols + ",minmax(0,1fr));gap:0.75rem;";

    cards.forEach(function(c) {
      const card = document.createElement("div");
      card.style.cssText = "border:1px solid " + border + ";border-radius:8px;padding:0.75rem;background:" + cardBg + ";display:flex;flex-direction:column;gap:0.25rem;";

      const val = document.createElement("div");
      val.textContent = c.value;
      val.style.cssText = "font-size:1.25rem;font-weight:700;color:" + primary + ";line-height:1.2;";
      card.appendChild(val);

      const lbl = document.createElement("div");
      lbl.textContent = c.label;
      lbl.style.cssText = "font-size:0.75rem;color:" + muted + ";";
      card.appendChild(lbl);

      if (c.change) {
        const isUp = c.trend === "up";
        const isDown = c.trend === "down";
        const pillBg = isUp ? "hsl(160 84% 39%)" : (isDown ? red : muted);
        const pillFg = isUp ? "#fff" : (isDown ? "#fff" : fg);
        const pillEl = badge(c.change, pillBg, pillFg);
        pillEl.style.marginTop = "0.125rem";
        card.appendChild(pillEl);
      }

      grid.appendChild(card);
    });

    el.appendChild(grid);
  }

  /* ── Expose ── */
  global.pi = {
    barChart: barChart,
    pieChart: pieChart,
    table: table,
    prosCons: prosCons,
    timeline: timeline,
    metrics: metrics,
  };
})(window);
`;
