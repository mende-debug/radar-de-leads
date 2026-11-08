import { esc, fmtPct, fmtDate, todayISO, addDays, relTime, getLocale } from "../util.js";
import { t } from "../i18n.js";
import * as S from "../store.js";
import { icon } from "../ui.js";
import { columns, hbars, bindTips } from "../charts.js";
import { money, avatar, scoreBadge, stageBadge, dueChip, openLead, originLabel } from "../components.js";

const startOfMonth = (off = 0) => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() + off); return d.toISOString(); };
function delta(cur, prev) {
  if (!prev && !cur) return "";
  if (!prev) return `<span class="delta up">${t("dash.new")}</span>`;
  const p = (cur - prev) / prev;
  return `<span class="delta ${p >= 0 ? "up" : "down"}">${p >= 0 ? "▲" : "▼"} ${fmtPct(Math.abs(p))}</span>`;
}

export default {
  title: () => t("nav.painel"),
  mount(el) { el.innerHTML = `<div id="dash"></div>`; bindTips(el); this.refresh(el); },
  refresh(el) {
    const c = S.cfg(), L = S.state.leads, open = L.filter(S.isOpen), td = todayISO();
    const m0 = startOfMonth(0), m1 = startOfMonth(-1);
    const wonM = L.filter(l => S.isWon(l) && (l.ganhoEm || "") >= m0), wonPrev = L.filter(l => S.isWon(l) && (l.ganhoEm || "") >= m1 && (l.ganhoEm || "") < m0);
    const sum = a => a.reduce((s, l) => s + (+l.valor || 0), 0);
    const pipe = sum(open), weighted = open.reduce((s, l) => s + (+l.valor || 0) * (S.stage(l.etapa).prob || 0) / 100, 0);
    const d30 = new Date(Date.now() - 30 * 864e5).toISOString(), d60 = new Date(Date.now() - 60 * 864e5).toISOString();
    const new30 = L.filter(l => l.criadoEm >= d30).length, newPrev = L.filter(l => l.criadoEm >= d60 && l.criadoEm < d30).length;
    const won = L.filter(S.isWon).length, lost = L.filter(S.isLost).length;
    const conv = won + lost ? won / (won + lost) : 0;
    const meta = +c.metaMensal || 0, wonVal = sum(wonM);

    // 12 semanas de leads novos
    const weeks = [];
    const monday = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const w0 = monday(new Date());
    for (let i = 11; i >= 0; i--) {
      const s = new Date(w0); s.setDate(s.getDate() - i * 7); const e = new Date(s); e.setDate(e.getDate() + 7);
      const n = L.filter(l => { const d = new Date(l.criadoEm); return d >= s && d < e; }).length;
      weeks.push({ label: s.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit" }), value: n, tip: `${t("dash.weekOf")} ${fmtDate(s.toISOString())}: ${n} ${t("dash.leadsWord")}` });
    }
    const funnel = c.etapas.filter(s => s.tipo !== "perdido").map(s => { const ls = L.filter(l => l.etapa === s.id); return { label: s.nome, value: ls.length, color: s.cor, sub: money(sum(ls)), tip: `${s.nome}: ${ls.length} · ${money(sum(ls))}` }; });
    const bySrc = Object.entries(L.reduce((m, l) => (m[l.origem] = (m[l.origem] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([o, n]) => ({ label: originLabel(o), value: n, tip: `${originLabel(o)}: ${n}` }));
    const tasks = L.flatMap(l => (l.tarefas || []).filter(k => !k.feita && k.vence <= td).map(k => ({ l, k }))).sort((a, b) => a.k.vence.localeCompare(b.k.vence));
    const hot = open.map(l => ({ l, s: S.score(l) })).sort((a, b) => b.s - a.s).slice(0, 5);
    const acts = L.flatMap(l => l.atividades.map(a => ({ l, a }))).sort((a, b) => b.a.em.localeCompare(a.a.em)).slice(0, 7);
    const h = new Date().getHours();
    const hello = t(h < 12 ? "dash.morning" : h < 18 ? "dash.afternoon" : "dash.evening") + (c.usuario ? ", " + c.usuario.split(" ")[0] : "");

    el.querySelector("#dash").innerHTML = `
      <div class="page-h"><div><h1>${esc(hello)}</h1><p class="muted">${esc(new Date().toLocaleDateString(getLocale(), { weekday: "long", day: "numeric", month: "long" }))} · ${tasks.length ? t("dash.tasksWaiting").replace("{n}", tasks.length) : t("dash.allClear")}</p></div>
        <div class="row"><a class="btn" href="#prospectar">${icon("radar")}${t("dash.findLeads")}</a><button class="btn primary" data-action="new-lead">${icon("plus")}${t("lead.new")}</button></div></div>
      <section class="kpis">
        <article class="kpi"><span class="kpi-l">${t("dash.pipeline")}</span><b>${money(pipe)}</b><span class="kpi-s">${t("dash.weighted")}: ${money(weighted)} · ${open.length} ${t("dash.open")}</span></article>
        <article class="kpi"><span class="kpi-l">${t("dash.wonMonth")}</span><b>${money(wonVal)}</b><span class="kpi-s">${delta(wonVal, sum(wonPrev))} ${wonM.length} ${t("dash.deals")}</span>
          ${meta ? `<div class="meter" title="${t("dash.goal")}: ${money(meta)}"><span style="width:${Math.min(100, wonVal / meta * 100)}%"></span></div><span class="kpi-s">${fmtPct(wonVal / meta)} ${t("dash.ofGoal")} ${money(meta)}</span>` : ""}</article>
        <article class="kpi"><span class="kpi-l">${t("dash.new30")}</span><b>${new30}</b><span class="kpi-s">${delta(new30, newPrev)} ${t("dash.vsPrev")}</span></article>
        <article class="kpi"><span class="kpi-l">${t("dash.conversion")}</span><b>${won + lost ? fmtPct(conv) : "—"}</b><span class="kpi-s">${won} ${t("dash.won")} · ${lost} ${t("dash.lost")}</span></article>
      </section>
      <div class="dash-grid">
        <section class="card span2"><header class="card-h"><h2>${t("dash.newPerWeek")}</h2><span class="muted sm">${t("dash.last12")}</span></header>${columns(weeks)}</section>
        <section class="card"><header class="card-h"><h2>${t("dash.today")}</h2><a href="#tarefas" class="link sm">${t("common.seeAll")}</a></header>
          <ul class="mini-list">${tasks.slice(0, 6).map(({ l, k }) => `<li><button class="ck" data-tk="${esc(k.id)}" data-l="${esc(l.id)}" aria-label="${t("task.toggle")}">${icon("check")}</button>
            <button class="ml-main" data-open="${esc(l.id)}"><b>${esc(k.titulo)}</b><span>${esc(S.leadName(l))}</span></button>${dueChip(k)}</li>`).join("") || `<li class="empty">${icon("check")} ${t("dash.noTasks")}</li>`}</ul></section>
        <section class="card"><header class="card-h"><h2>${t("dash.funnel")}</h2><a href="#pipeline" class="link sm">${t("nav.pipeline")}</a></header>${hbars(funnel)}</section>
        <section class="card"><header class="card-h"><h2>${t("dash.hot")}</h2><a href="#leads" class="link sm">${t("common.seeAll")}</a></header>
          <ul class="mini-list">${hot.map(({ l }) => `<li><button class="ml-main row-btn" data-open="${esc(l.id)}">${avatar(l)}<span class="ml-txt"><b>${esc(S.leadName(l))}</b><span>${stageBadge(l.etapa)} ${money(l.valor)}</span></span></button>${scoreBadge(l)}</li>`).join("") || `<li class="empty">${t("dash.noLeads")}</li>`}</ul></section>
        <section class="card"><header class="card-h"><h2>${t("dash.sources")}</h2></header>${bySrc.length ? hbars(bySrc) : `<p class="empty">${t("dash.noLeads")}</p>`}</section>
        <section class="card span2"><header class="card-h"><h2>${t("dash.activity")}</h2></header>
          <ul class="feed">${acts.map(({ l, a }) => `<li><button class="row-btn" data-open="${esc(l.id)}">${avatar(l, "sm")}<span><b>${esc(S.leadName(l))}</b> · ${t("actType." + a.tipo)}${a.texto ? ` <span class="muted">${esc(a.texto.slice(0, 80))}</span>` : ""}</span><time>${esc(relTime(a.em))}</time></button></li>`).join("") || `<li class="empty">${t("act.empty")}</li>`}</ul></section>
      </div>`;
    el.querySelector("#dash").onclick = e => {
      const tk = e.target.closest("[data-tk]"); if (tk) { S.toggleTask(tk.dataset.l, tk.dataset.tk); return; }
      const o = e.target.closest("[data-open]"); if (o) openLead(o.dataset.open);
    };
  }
};
