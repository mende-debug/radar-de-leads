import { $, esc, todayISO, addDays, fmtDate } from "../util.js";
import { t } from "../i18n.js";
import * as S from "../store.js";
import { icon, toast } from "../ui.js";
import { avatar, stageBadge, openLead, dueChip } from "../components.js";

let showDone = false;
export default {
  title: () => t("nav.tarefas"),
  mount(el) {
    el.innerHTML = `<div class="page-h"><div><h1>${t("nav.tarefas")}</h1><p class="muted" id="tk_sum"></p></div>
      <label class="check"><input type="checkbox" id="tk_done" ${showDone ? "checked" : ""}> ${t("task.showDone")}</label></div>
      <div id="tk_groups" class="tk-groups"></div>`;
    $("#tk_done", el).onchange = e => { showDone = e.target.checked; this.refresh(el); };
    $("#tk_groups", el).onclick = e => {
      const ck = e.target.closest("[data-tk]"); if (ck) { S.toggleTask(ck.dataset.l, ck.dataset.tk); if (ck.getAttribute("aria-pressed") === "false") toast(t("task.completed")); return; }
      const snooze = e.target.closest("[data-snooze]"); if (snooze) { const l = S.getLead(snooze.dataset.l), k = l?.tarefas.find(x => x.id === snooze.dataset.snooze); if (k) { k.vence = addDays(todayISO(), +snooze.dataset.n); l.atualizadoEm = new Date().toISOString(); S.persist(); toast(t("task.snoozed")); } return; }
      const o = e.target.closest("[data-open]"); if (o) openLead(o.dataset.open, { tab: "tarefas" });
    };
    this.refresh(el);
  },
  refresh(el) {
    const td = todayISO(), wk = addDays(td, 7);
    const all = S.state.leads.flatMap(l => (l.tarefas || []).map(k => ({ l, k }))).filter(x => showDone || !x.k.feita).sort((a, b) => (a.k.vence || "").localeCompare(b.k.vence || ""));
    const open = all.filter(x => !x.k.feita);
    const groups = [
      ["late", t("task.gLate"), open.filter(x => x.k.vence < td)],
      ["today", t("task.gToday"), open.filter(x => x.k.vence === td)],
      ["week", t("task.gWeek"), open.filter(x => x.k.vence > td && x.k.vence <= wk)],
      ["later", t("task.gLater"), open.filter(x => x.k.vence > wk)],
      ["done", t("task.done"), all.filter(x => x.k.feita).reverse().slice(0, 50)]
    ].filter(g => g[2].length);
    $("#tk_sum", el).textContent = t("task.summary").replace("{late}", groups.find(g => g[0] === "late")?.[2].length || 0).replace("{today}", groups.find(g => g[0] === "today")?.[2].length || 0);
    $("#tk_groups", el).innerHTML = groups.map(([k, label, items]) => `<section class="card tk-g ${k}"><header class="card-h"><h2>${esc(label)} <span class="count">${items.length}</span></h2></header>
      <ul class="tk-list">${items.map(({ l, k: tk }) => `<li class="${tk.feita ? "is-done" : ""}">
        <button class="ck" data-tk="${esc(tk.id)}" data-l="${esc(l.id)}" aria-pressed="${!!tk.feita}" aria-label="${t("task.toggle")}">${icon("check")}</button>
        <button class="tk-main" data-open="${esc(l.id)}"><b>${esc(tk.titulo)}</b><span>${avatar(l, "xs")} ${esc(S.leadName(l))} ${stageBadge(l.etapa)}</span></button>
        ${tk.feita ? `<span class="muted sm">${esc(fmtDate(tk.feitaEm))}</span>` : `${dueChip(tk)}<span class="snooze"><button class="chip-btn" data-snooze="${esc(tk.id)}" data-l="${esc(l.id)}" data-n="1">+1d</button><button class="chip-btn" data-snooze="${esc(tk.id)}" data-l="${esc(l.id)}" data-n="7">+7d</button></span>`}
      </li>`).join("")}</ul></section>`).join("") ||
      `<div class="empty-state card">${icon("check")}<h2>${t("task.allDone")}</h2><p>${t("task.allDoneHint")}</p><a class="btn" href="#leads">${t("nav.leads")}</a></div>`;
  }
};
