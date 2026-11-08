// Componentes de interface: ícones, toast, modal, confirmação, drawer.
import { $, esc } from "./util.js";
import { t } from "./i18n.js";

const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  pipeline: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="11" rx="1.5"/><rect x="16" y="4" width="5" height="7" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  tasks: '<rect x="3.5" y="4" width="17" height="16.5" rx="2.5"/><path d="M8 2.5v3M16 2.5v3M3.5 9h17"/><path d="m8.5 14.5 2.5 2.5 4.5-4.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 18.4 5.6"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  message: '<path d="M4 5h16v11H9l-5 4z"/>',
  magnet: '<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z"/><path d="M6 7h4M14 7h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  phone: '<path d="M5 3.5h3.5l2 5-2.5 1.5a11 11 0 0 0 6 6l1.5-2.5 5 2V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
  whatsapp: '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1z"/><path d="M9 8.5c0 3.5 2.8 6.5 6.5 6.5l1-1.6-2-1-1 .8a4.5 4.5 0 0 1-2.7-2.7l.8-1-1-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/>',
  note: '<path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8.5 12.5h7M8.5 16h5"/>',
  calendar: '<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M8 2.5v4M16 2.5v4M3.5 9.5h17"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  map: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  flame: '<path d="M12 21c-4 0-6.5-2.7-6.5-6.3 0-3.7 3-5.6 3.5-9.2 2.5 1.5 3.6 3.5 3.8 5.5 1-.8 1.6-2 1.7-3.3 2.2 1.9 4 4.4 4 7.1 0 3.5-2.5 6.2-6.5 6.2z"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.5-4.5M4 13a8 8 0 0 0 14.5 4.5"/><path d="M5 3v4h4M19 21v-4h-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  dots: '<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  qr: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h3v3h-3zM18 18h2.5v2.5H18zM14 19.5h1.5M19.5 14v1.5"/>',
  tag: '<path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3.5 3.5 0 0 0 3.6 4M16 6h3.5a3.5 3.5 0 0 1-3.6 4M12 13v4M8 20.5h8M9.5 17h5v3.5h-5z"/>',
  sparkle: '<path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2z"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h1M10 10h1M13.5 10h1M17 10h.5M7 14h10"/>'
};
export const icon = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

export function toast(msg, kind = "") {
  const root = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast " + kind; el.setAttribute("role", "status"); el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 250); }, 2600);
}

const stack = [];
export function openModal({ title = "", body = "", size = "", onMount, onClose, footer = "" }) {
  const root = $("#overlays");
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      ${title ? `<header class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="${t("common.close")}">${icon("x")}</button></header>` : ""}
      <div class="modal-b">${body}</div>${footer ? `<footer class="modal-f">${footer}</footer>` : ""}</div>`;
  const prevFocus = document.activeElement;
  const close = () => { wrap.remove(); stack.splice(stack.indexOf(close), 1); onClose?.(); prevFocus?.focus?.(); };
  wrap.addEventListener("mousedown", e => { if (e.target === wrap) close(); });
  wrap.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
  root.appendChild(wrap); stack.push(close);
  onMount?.(wrap.querySelector(".modal"), close);
  setTimeout(() => (wrap.querySelector("[autofocus]") || wrap.querySelector("input,select,textarea,button:not([data-close])"))?.focus(), 30);
  return close;
}
export const closeTop = () => { const c = stack[stack.length - 1]; if (c) { c(); return true; } return false; };

export function confirmDialog(text, { ok = t("common.confirm"), danger = false } = {}) {
  return new Promise(res => {
    let done = false;
    openModal({
      title: t("common.sure"), size: "sm",
      body: `<p class="muted" style="margin:0">${esc(text)}</p>`,
      footer: `<button class="btn" data-close>${t("common.cancel")}</button><button class="btn ${danger ? "danger" : "primary"}" data-ok>${esc(ok)}</button>`,
      onMount: (m, close) => { m.querySelector("[data-ok]").onclick = () => { done = true; close(); res(true); }; },
      onClose: () => { if (!done) res(false); }
    });
  });
}

let drawerClose = null;
export function openDrawer(render, { onClose } = {}) {
  drawerClose?.();
  const root = $("#overlays");
  const wrap = document.createElement("div");
  wrap.className = "drawer-wrap";
  wrap.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true"></aside>`;
  const panel = wrap.firstElementChild;
  const close = () => { wrap.classList.add("out"); setTimeout(() => wrap.remove(), 180); stack.splice(stack.indexOf(close), 1); drawerClose = null; onClose?.(); };
  wrap.addEventListener("mousedown", e => { if (e.target === wrap) close(); });
  root.appendChild(wrap); stack.push(close); drawerClose = close;
  render(panel, close);
  return { close, panel, rerender: () => render(panel, close) };
}
export const drawerOpen = () => !!drawerClose;
