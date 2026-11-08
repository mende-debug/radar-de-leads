// Ponto de entrada: layout, rotas, paleta de comandos, tema e atalhos.
import { $, $$, esc, norm, todayISO, lsGet, setLocale, fmtDateTime } from "./util.js";
import { t, setLang, getLang, LOCALES } from "./i18n.js";
import * as S from "./store.js";
import * as Sync from "./sync.js";
import { icon, openModal, closeTop, toast } from "./ui.js";
import { leadForm, openLead, avatar, stageBadge } from "./components.js";
import dashboard from "./views/dashboard.js";
import pipeline from "./views/pipeline.js";
import leads from "./views/leads.js";
import tasks from "./views/tasks.js";
import prospect from "./views/prospect.js";
import messages from "./views/messages.js";
import capture from "./views/capture.js";
import settings from "./views/settings.js";

const VIEWS = { painel: dashboard, pipeline, leads, tarefas: tasks, prospectar: prospect, mensagens: messages, captacao: capture, config: settings };
const NAV = [["painel", "home"], ["pipeline", "pipeline"], ["leads", "users"], ["tarefas", "tasks"], ["prospectar", "radar"], ["mensagens", "message"], ["captacao", "magnet"], ["config", "settings"]];
const MOBILE = ["painel", "pipeline", "leads", "prospectar"];
let current = null, currentName = "";

/* ---------- Tema ---------- */
function applyTheme() {
  const th = lsGet("radar-crm-theme", "system");
  if (th === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = th;
  const dark = th === "dark" || (th === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  $('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0B111C" : "#F4F6F9");
}
addEventListener("themechange", applyTheme);
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

/* ---------- Layout ---------- */
function shell() {
  const c = S.cfg();
  document.title = `${c.empresa && c.empresa !== "Radar" ? c.empresa + " · " : ""}Radar CRM`;
  $("#app").innerHTML = `
    <aside class="side" aria-label="${t("nav.main")}">
      <a class="brand" href="#painel"><span class="logo">${icon("radar")}</span><span><b>Radar</b><small id="brand_name">${esc(c.empresa !== "Radar" ? c.empresa : "CRM")}</small></span></a>
      <button class="side-search" data-action="palette">${icon("search")}<span>${t("pal.search")}</span><kbd>${/Mac|iP/.test(navigator.platform) ? "⌘" : "Ctrl"} K</kbd></button>
      <nav class="side-nav">${NAV.map(([k, ic]) => `<a href="#${k}" data-nav="${k}">${icon(ic)}<span>${t("nav." + k)}</span><span class="nbadge" data-badge="${k}"></span></a>`).join("")}</nav>
      <div class="side-foot"><button class="sync-pill" id="sync_pill" data-action="sync">${icon("sync")}<span></span></button></div>
    </aside>
    <header class="topbar">
      <a class="brand sm" href="#painel"><span class="logo">${icon("radar")}</span><b>Radar</b></a>
      <span class="grow"></span>
      <button class="icon-btn" data-action="palette" aria-label="${t("pal.search")}">${icon("search")}</button>
      <button class="icon-btn sync-dot" id="sync_dot" data-action="sync" aria-label="${t("sync.title")}">${icon("sync")}</button>
    </header>
    <main id="view" class="view" tabindex="-1"></main>
    <button class="fab" data-action="new-lead" aria-label="${t("lead.new")}">${icon("plus")}</button>
    <nav class="bottom" aria-label="${t("nav.main")}">${MOBILE.map(k => { const ic = NAV.find(n => n[0] === k)[1]; return `<a href="#${k}" data-nav="${k}">${icon(ic)}<span>${t("nav." + k)}</span><span class="nbadge" data-badge="${k}"></span></a>`; }).join("")}
      <button data-action="more" data-nav="more">${icon("menu")}<span>${t("nav.more")}</span><span class="nbadge" data-badge="tarefas"></span></button></nav>`;
}

function route() {
  const name = (location.hash || "#painel").slice(1);
  const V = VIEWS[name] ? name : "painel";
  closeTop();
  if (currentName === V && current) return;
  current?.unmount?.();
  currentName = V; current = VIEWS[V];
  $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === V || (a.dataset.nav === "more" && !MOBILE.includes(V))));
  const el = $("#view"); el.className = "view v-" + V; el.innerHTML = "";
  current.mount(el);
  el.scrollTop = 0; scrollTo(0, 0);
  document.title = `${current.title()} · ${S.cfg().empresa !== "Radar" ? S.cfg().empresa : "Radar CRM"}`;
}
function badges() {
  const td = todayISO();
  const due = S.state.leads.reduce((n, l) => n + l.tarefas.filter(k => !k.feita && k.vence <= td).length, 0);
  $$('[data-badge="tarefas"]').forEach(b => { b.textContent = due || ""; b.hidden = !due; });
  $$(".nbadge:not([data-badge='tarefas'])").forEach(b => (b.hidden = true));
}
function syncUI(st) {
  const map = { off: ["", t("sync.offShort")], ok: ["ok", t("sync.on")], busy: ["busy", t("sync.busy")], pending: ["busy", t("sync.pending")], error: ["bad", t("sync.error")] };
  const [cls, lbl] = map[st.state] || map.off;
  const pill = $("#sync_pill"); if (pill) { pill.className = "sync-pill " + cls; pill.querySelector("span").textContent = lbl; pill.title = st.state === "error" ? st.msg : st.last ? t("sync.last").replace("{d}", fmtDateTime(st.last)) : ""; }
  const dot = $("#sync_dot"); if (dot) dot.className = "icon-btn sync-dot " + cls;
}

/* ---------- Paleta de comandos ---------- */
function palette() {
  const actions = [
    { label: t("lead.new"), ic: "plus", run: () => leadForm(null), kw: "novo new nuevo lead" },
    ...NAV.map(([k, ic]) => ({ label: t("pal.goto") + " " + t("nav." + k), ic, run: () => (location.hash = k), kw: k })),
    { label: t("pal.sync"), ic: "sync", run: () => Sync.run(), kw: "sync" }
  ];
  openModal({
    size: "palette",
    body: `<label class="pal-in">${icon("search")}<input id="pal_q" placeholder="${t("pal.placeholder")}" autocomplete="off" autofocus></label><ul class="pal-list" id="pal_list" role="listbox"></ul>
      <p class="pal-foot muted sm">${icon("keyboard")} ↑↓ ${t("pal.nav")} · Enter ${t("pal.open")} · N ${t("lead.new").toLowerCase()} · Esc</p>`,
    onMount: (m, close) => {
      let items = [], idx = 0;
      const render = () => {
        const q = norm($("#pal_q", m).value);
        const ls = q ? S.state.leads.filter(l => norm([l.empresa, l.contato, l.email, l.telefone, l.cidade].join(" ")).includes(q)).slice(0, 8) : [...S.state.leads].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)).slice(0, 5);
        const acts = actions.filter(a => !q || norm(a.label + " " + a.kw).includes(q)).slice(0, q ? 5 : 4);
        items = [...ls.map(l => ({ lead: l, run: () => openLead(l.id) })), ...acts];
        idx = Math.min(idx, items.length - 1);
        $("#pal_list", m).innerHTML = (ls.length ? `<li class="pal-h">${q ? t("nav.leads") : t("pal.recent")}</li>` : "") +
          items.map((it, i) => it.lead ? `<li role="option" data-i="${i}" aria-selected="${i === idx}">${avatar(it.lead, "xs")}<span class="grow">${esc(S.leadName(it.lead))} <small class="muted">${esc(it.lead.contato && it.lead.empresa ? it.lead.contato : it.lead.cidade || "")}</small></span>${stageBadge(it.lead.etapa)}</li>`
            : `${i === ls.length ? `<li class="pal-h">${t("pal.actions")}</li>` : ""}<li role="option" data-i="${i}" aria-selected="${i === idx}">${icon(it.ic)}<span class="grow">${esc(it.label)}</span></li>`).join("") ||
          `<li class="empty">${t("pal.none")}</li>`;
      };
      const go = i => { const it = items[i]; if (!it) return; close(); it.run(); };
      $("#pal_q", m).addEventListener("input", () => { idx = 0; render(); });
      $("#pal_q", m).addEventListener("keydown", e => {
        if (e.key === "ArrowDown") { idx = (idx + 1) % items.length; render(); e.preventDefault(); }
        if (e.key === "ArrowUp") { idx = (idx - 1 + items.length) % items.length; render(); e.preventDefault(); }
        if (e.key === "Enter") { e.preventDefault(); go(idx); }
      });
      $("#pal_list", m).onclick = e => { const li = e.target.closest("[data-i]"); if (li) go(+li.dataset.i); };
      render();
    }
  });
}
function moreMenu() {
  openModal({
    title: t("nav.more"), size: "sheet",
    body: `<nav class="more-list">${NAV.filter(([k]) => !MOBILE.includes(k)).map(([k, ic]) => `<a href="#${k}" data-close>${icon(ic)}<span>${t("nav." + k)}</span><span class="nbadge" data-badge="${k}"></span>${icon("chevron", "dim")}</a>`).join("")}</nav>`,
    onMount: () => badges()
  });
}

/* ---------- Inicialização ---------- */
function boot() {
  const saved = lsGet("radar-crm-lang");
  setLang(saved || (navigator.language || "pt").slice(0, 2));
  S.load();
  if (S.cfg().idioma && S.cfg().idioma !== getLang() && !saved) setLang(S.cfg().idioma);
  setLocale(LOCALES[getLang()]);
  document.documentElement.lang = LOCALES[getLang()];
  applyTheme(); shell(); route(); badges();
  addEventListener("hashchange", route);
  addEventListener("brand", () => { const c = S.cfg(); $("#brand_name").textContent = c.empresa !== "Radar" ? c.empresa : "CRM"; });
  S.subscribe(() => { badges(); if (currentName !== "config" && currentName !== "prospectar") current?.refresh?.($("#view")); else if (currentName === "prospectar") current.refresh($("#view")); });
  Sync.onStatus(syncUI); Sync.start(); syncUI(Sync.status);

  document.addEventListener("click", e => {
    const a = e.target.closest("[data-action]"); if (!a) return;
    const act = a.dataset.action;
    if (act === "new-lead") leadForm(null, { onSaved: l => openLead(l.id) });
    if (act === "palette") palette();
    if (act === "more") moreMenu();
    if (act === "sync") { if (Sync.connected()) { Sync.run(); toast(t("sync.busy")); } else location.hash = "config"; }
  });
  document.addEventListener("keydown", e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); closeTop(); palette(); return; }
    if (e.key === "Escape") { if (closeTop()) e.preventDefault(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || $(".modal-wrap")) return;
    if (e.key === "n" || e.key === "N") { e.preventDefault(); leadForm(null, { onSaved: l => openLead(l.id) }); }
    if (e.key === "/") { e.preventDefault(); palette(); }
    const n = +e.key; if (n >= 1 && n <= NAV.length) location.hash = NAV[n - 1][0];
  });
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
}
boot();
