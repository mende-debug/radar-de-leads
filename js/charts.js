// Gráficos SVG leves com tooltip. Uma série = uma cor (accent); texto sempre em tokens de texto.
import { esc, fmtNum } from "./util.js";

function niceMax(v) { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }

// Colunas verticais (série temporal curta). data: [{label, value, tip}]
export function columns(data, { height = 180, highlightLast = true } = {}) {
  const W = 600, H = height, padL = 30, padB = 24, padT = 10, n = data.length || 1;
  const max = niceMax(Math.max(1, ...data.map(d => d.value)));
  const bw = (W - padL) / n, barW = Math.min(30, bw - 6);
  const y = v => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const bars = data.map((d, i) => {
    const x = padL + i * bw + (bw - barW) / 2, top = y(d.value), base = y(0), h = base - top, r = Math.min(4, h);
    const path = h > 0 ? `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z` : "";
    const last = highlightLast && i === n - 1;
    return `<g class="bar" data-tip="${esc(d.tip || d.label + ": " + fmtNum(d.value))}">
      <rect x="${padL + i * bw}" y="${padT}" width="${bw}" height="${H - padT - padB}" fill="transparent"/>
      ${path ? `<path d="${path}" fill="var(--accent)" opacity="${last ? 1 : 0.55}"/>` : `<rect x="${x}" y="${base - 1}" width="${barW}" height="1" fill="var(--line-strong)"/>`}
      ${i % Math.ceil(n / 6) === 0 || i === n - 1 ? `<text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle" class="ax">${esc(d.label)}</text>` : ""}
    </g>`;
  }).join("");
  const grid = ticks.map(v => `<line x1="${padL}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${fmtNum(v)}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${grid}${bars}</svg>`;
}

// Barras horizontais com rótulo e valor. rows: [{label, value, sub, color, tip}]
export function hbars(rows, { fmt = fmtNum } = {}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return `<ul class="hbars">${rows.map(r => `<li data-tip="${esc(r.tip || "")}">
    <span class="hb-l">${r.color ? `<i class="dot" style="--c:${esc(r.color)}"></i>` : ""}${esc(r.label)}</span>
    <span class="hb-track"><span class="hb-fill" style="width:${(r.value / max) * 100}%"></span></span>
    <span class="hb-v">${esc(fmt(r.value))}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</span></li>`).join("")}</ul>`;
}

// Tooltip compartilhado para qualquer [data-tip] dentro de root.
export function bindTips(root) {
  let tip = document.getElementById("chart-tip");
  if (!tip) { tip = document.createElement("div"); tip.id = "chart-tip"; tip.className = "chart-tip"; tip.hidden = true; document.body.appendChild(tip); }
  root.addEventListener("pointermove", e => {
    const el = e.target.closest("[data-tip]");
    if (!el || !el.dataset.tip) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, e.clientX - r.width / 2)) + "px";
    tip.style.top = Math.max(8, e.clientY - r.height - 12) + "px";
  });
  root.addEventListener("pointerleave", () => { tip.hidden = true; });
}
