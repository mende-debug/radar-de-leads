import { $, $$, esc, norm, relTime, todayISO, toCSV, download, splitList } from "../util.js";
import { t } from "../i18n.js";
import * as S from "../store.js";
import { icon, toast, confirmDialog } from "../ui.js";
import { money, avatar, scoreBadge, stageBadge, productChips, dueChip, openLead, originLabel } from "../components.js";
import { importCSVDialog } from "./settings.js";

const st = { q: "", stage: "", prod: "", owner: "", src: "", tag: "", view: "all", sort: "score", dir: -1, sel: new Set(), limit: 100 };
const VIEWS = ["all", "hot", "nocontact", "late", "won"];

function filtered() {
  const q = norm(st.q), td = todayISO();
  return S.state.leads.filter(l => {
    if (st.stage && l.etapa !== st.stage) return false;
    if (st.prod && !l.produtos.includes(st.prod)) return false;
    if (st.owner && l.responsavel !== st.owner) return false;
    if (st.src && l.origem !== st.src) return false;
    if (st.tag && !(l.tags || []).includes(st.tag)) return false;
    if (st.view === "hot" && !(S.isOpen(l) && S.score(l) >= 70)) return false;
    if (st.view === "nocontact" && !(S.isOpen(l) && S.stageIndex(l.etapa) === 0)) return false;
    if (st.view === "late" && !l.tarefas.some(k => !k.feita && k.vence < td)) return false;
    if (st.view === "won" && !S.isWon(l)) return false;
    if (q && !norm([l.empresa, l.contato, l.email, l.telefone, l.cidade, l.segmento, l.notas, (l.tags || []).join(" ")].join(" ")).includes(q)) return false;
    return true;
  });
}
const KEYS = {
  empresa: l => norm(S.leadName(l)), etapa: l => S.stageIndex(l.etapa), valor: l => +l.valor || 0, score: l => S.score(l),
  proxima: l => S.nextTask(l)?.vence || "9999", atualizado: l => l.atualizadoEm || ""
};
function sorted(L) { const k = KEYS[st.sort] || KEYS.score; return [...L].sort((a, b) => { const x = k(a), y = k(b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; }); }

export function exportCSV(list) {
  const head = ["empresa", "contato", "cargo", "telefone", "email", "pais", "cidade", "segmento", "site", "instagram", "etapa", "produtos", "valor", "responsavel", "origem", "tags", "score", "avaliacoes", "nota", "proxima_tarefa", "criado_em", "atualizado_em", "notas"];
  const rows = list.map(l => [l.empresa, l.contato, l.cargo, l.telefone, l.email, l.pais, l.cidade, l.segmento, l.site, l.instagram, S.stage(l.etapa).nome,
    l.produtos.map(id => S.product(id)?.nome).join(" | "), l.valor, l.responsavel, originLabel(l.origem), (l.tags || []).join(" | "), S.score(l), l.avaliacoes ?? "", l.nota ?? "",
    S.nextTask(l)?.vence || "", (l.criadoEm || "").slice(0, 10), (l.atualizadoEm || "").slice(0, 10), l.notas]);
  download(`leads-${todayISO()}.csv`, "﻿" + toCSV([head, ...rows]), "text/csv;charset=utf-8");
}

export default {
  title: () => t("nav.leads"),
  mount(el) {
    const c = S.cfg();
    const owners = [...new Set(S.state.leads.map(l => l.responsavel).filter(Boolean))];
    const tags = [...new Set(S.state.leads.flatMap(l => l.tags || []))].sort();
    const srcs = [...new Set([...c.origens, ...S.state.leads.map(l => l.origem)])];
    el.innerHTML = `
      <div class="page-h"><div><h1>${t("nav.leads")}</h1><p class="muted" id="ld_count"></p></div>
        <div class="row"><button class="btn" id="ld_imp">${icon("upload")}${t("data.importCsv")}</button><button class="btn" id="ld_exp">${icon("download")}${t("data.exportCsv")}</button><button class="btn primary" data-action="new-lead">${icon("plus")}${t("lead.new")}</button></div></div>
      <div class="views" role="tablist">${VIEWS.map(v => `<button role="tab" data-v="${v}" aria-selected="${st.view === v}">${t("lview." + v)} <span class="count" data-vc="${v}"></span></button>`).join("")}</div>
      <div class="toolbar">
        <label class="search-in">${icon("search")}<input id="ld_q" type="search" placeholder="${t("leads.search")}" value="${esc(st.q)}" aria-label="${t("leads.search")}"></label>
        <select id="ld_stage" aria-label="${t("f.etapa")}"><option value="">${t("leads.allStages")}</option>${c.etapas.map(s => `<option value="${esc(s.id)}" ${st.stage === s.id ? "selected" : ""}>${esc(s.nome)}</option>`).join("")}</select>
        <select id="ld_prod" aria-label="${t("f.produtos")}"><option value="">${t("leads.allProducts")}</option>${c.produtos.map(p => `<option value="${esc(p.id)}" ${st.prod === p.id ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select>
        <select id="ld_src" aria-label="${t("f.origem")}"><option value="">${t("leads.allSources")}</option>${srcs.map(o => `<option value="${esc(o)}" ${st.src === o ? "selected" : ""}>${esc(originLabel(o))}</option>`).join("")}</select>
        ${owners.length ? `<select id="ld_owner" aria-label="${t("f.responsavel")}"><option value="">${t("leads.allOwners")}</option>${owners.map(o => `<option ${st.owner === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>` : ""}
        ${tags.length ? `<select id="ld_tag" aria-label="${t("f.tags")}"><option value="">${t("leads.allTags")}</option>${tags.map(o => `<option ${st.tag === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>` : ""}
      </div>
      <div class="bulk" id="ld_bulk" hidden>
        <b id="ld_selc"></b>
        <select id="bk_stage" aria-label="${t("bulk.move")}"><option value="">${t("bulk.move")}…</option>${c.etapas.map(s => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join("")}</select>
        <input id="bk_owner" list="bk_team" placeholder="${t("bulk.assign")}…" aria-label="${t("bulk.assign")}" style="width:150px"><datalist id="bk_team">${[...new Set([...(c.equipe || []), c.usuario, ...owners].filter(Boolean))].map(n => `<option value="${esc(n)}">`).join("")}</datalist>
        <input id="bk_tag" placeholder="${t("bulk.tag")}…" aria-label="${t("bulk.tag")}" style="width:130px">
        <button class="btn sm" id="bk_apply">${t("bulk.apply")}</button>
        <button class="btn sm" id="bk_exp">${icon("download")}CSV</button>
        <button class="btn sm danger" id="bk_del">${icon("trash")}${t("common.delete")}</button>
        <button class="btn sm ghost" id="bk_clear">${t("bulk.clear")}</button>
      </div>
      <div class="table-wrap"><table class="tbl" id="ld_tbl">
        <thead><tr><th class="c-ck"><input type="checkbox" id="ld_all" aria-label="${t("bulk.selectAll")}"></th>
          ${[["empresa", t("f.empresa")], ["etapa", t("f.etapa")], ["", t("f.produtos")], ["valor", t("f.valor")], ["score", "Score"], ["proxima", t("task.next")], ["", t("f.origem")], ["atualizado", t("lead.updatedAt")]]
            .map(([k, lbl]) => k ? `<th><button class="th-sort" data-sort="${k}" aria-sort="${st.sort === k ? (st.dir > 0 ? "ascending" : "descending") : "none"}">${esc(lbl)}<span class="arr">${st.sort === k ? (st.dir > 0 ? "↑" : "↓") : ""}</span></button></th>` : `<th>${esc(lbl)}</th>`).join("")}</tr></thead>
        <tbody id="ld_body"></tbody></table></div>
      <div class="row center" id="ld_more"></div>`;
    const read = () => {
      st.q = $("#ld_q", el).value; st.stage = $("#ld_stage", el).value; st.prod = $("#ld_prod", el).value; st.src = $("#ld_src", el).value;
      st.owner = $("#ld_owner", el)?.value || ""; st.tag = $("#ld_tag", el)?.value || ""; st.limit = 100; this.refresh(el);
    };
    ["#ld_q", "#ld_stage", "#ld_prod", "#ld_src", "#ld_owner", "#ld_tag"].forEach(s => $(s, el)?.addEventListener("input", read));
    $(".views", el).onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; st.view = b.dataset.v; $$(".views button", el).forEach(x => x.setAttribute("aria-selected", x === b)); this.refresh(el); };
    $("thead", el).onclick = e => {
      const b = e.target.closest("[data-sort]"); if (!b) return;
      if (st.sort === b.dataset.sort) st.dir *= -1; else { st.sort = b.dataset.sort; st.dir = ["empresa", "proxima", "etapa"].includes(st.sort) ? 1 : -1; }
      $$("[data-sort]", el).forEach(x => { const on = x.dataset.sort === st.sort; x.setAttribute("aria-sort", on ? (st.dir > 0 ? "ascending" : "descending") : "none"); x.querySelector(".arr").textContent = on ? (st.dir > 0 ? "↑" : "↓") : ""; });
      this.refresh(el);
    };
    $("#ld_all", el).onchange = e => { const ids = sorted(filtered()).slice(0, st.limit).map(l => l.id); ids.forEach(id => e.target.checked ? st.sel.add(id) : st.sel.delete(id)); this.refresh(el); };
    $("#ld_body", el).addEventListener("click", e => {
      const ck = e.target.closest("input[data-ck]");
      if (ck) { ck.checked ? st.sel.add(ck.dataset.ck) : st.sel.delete(ck.dataset.ck); this.bulkBar(el); return; }
      if (e.target.closest("a,button,input,label")) return;
      const tr = e.target.closest("tr[data-id]"); if (tr) openLead(tr.dataset.id);
    });
    $("#ld_body", el).addEventListener("keydown", e => { const tr = e.target.closest("tr[data-id]"); if (tr && e.key === "Enter" && e.target === tr) openLead(tr.dataset.id); });
    $("#ld_more", el).onclick = e => { if (e.target.closest("button")) { st.limit += 200; this.refresh(el); } };
    $("#ld_exp", el).onclick = () => { const L = sorted(filtered()); exportCSV(L); toast(t("data.exported").replace("{n}", L.length)); };
    $("#ld_imp", el).onclick = () => importCSVDialog();
    $("#bk_apply", el).onclick = () => {
      const ids = [...st.sel], stg = $("#bk_stage", el).value, own = $("#bk_owner", el).value.trim(), tag = $("#bk_tag", el).value.trim();
      if (!stg && !own && !tag) { toast(t("bulk.nothing"), "warn"); return; }
      if (stg) S.setStage(ids, stg);
      if (own || tag) S.updateMany(ids, l => { if (own) l.responsavel = own; if (tag) l.tags = [...new Set([...(l.tags || []), ...splitList(tag)])]; });
      $("#bk_stage", el).value = ""; $("#bk_owner", el).value = ""; $("#bk_tag", el).value = "";
      toast(t("bulk.done").replace("{n}", ids.length));
    };
    $("#bk_exp", el).onclick = () => exportCSV(S.state.leads.filter(l => st.sel.has(l.id)));
    $("#bk_del", el).onclick = async () => {
      const n = st.sel.size;
      if (await confirmDialog(t("bulk.confirmDelete").replace("{n}", n), { ok: t("common.delete"), danger: true })) { S.deleteLeads([...st.sel]); st.sel.clear(); toast(t("bulk.deleted").replace("{n}", n)); }
    };
    $("#bk_clear", el).onclick = () => { st.sel.clear(); this.refresh(el); };
    this.refresh(el);
  },
  bulkBar(el) {
    const ids = new Set(S.state.leads.map(l => l.id));
    for (const id of [...st.sel]) if (!ids.has(id)) st.sel.delete(id);
    $("#ld_bulk", el).hidden = !st.sel.size;
    $("#ld_selc", el).textContent = t("bulk.selected").replace("{n}", st.sel.size);
  },
  refresh(el) {
    const td = todayISO();
    const counts = {
      all: S.state.leads.length, hot: S.state.leads.filter(l => S.isOpen(l) && S.score(l) >= 70).length,
      nocontact: S.state.leads.filter(l => S.isOpen(l) && S.stageIndex(l.etapa) === 0).length,
      late: S.state.leads.filter(l => l.tarefas.some(k => !k.feita && k.vence < td)).length, won: S.state.leads.filter(S.isWon).length
    };
    $$("[data-vc]", el).forEach(s => (s.textContent = counts[s.dataset.vc] || ""));
    const L = sorted(filtered()), shown = L.slice(0, st.limit);
    $("#ld_count", el).textContent = t("leads.count").replace("{n}", L.length).replace("{v}", money(L.reduce((s, l) => s + (+l.valor || 0), 0)));
    $("#ld_body", el).innerHTML = shown.map(l => {
      const nt = S.nextTask(l);
      return `<tr data-id="${esc(l.id)}" tabindex="0" class="${st.sel.has(l.id) ? "sel" : ""}">
        <td class="c-ck"><input type="checkbox" data-ck="${esc(l.id)}" ${st.sel.has(l.id) ? "checked" : ""} aria-label="${t("bulk.select")} ${esc(S.leadName(l))}"></td>
        <td class="c-name"><div class="cn">${avatar(l, "sm")}<span><b>${esc(S.leadName(l))}</b><small>${esc([l.contato && l.empresa ? l.contato : "", l.cidade].filter(Boolean).join(" · "))}</small></span></div></td>
        <td data-l="${t("f.etapa")}">${stageBadge(l.etapa)}</td>
        <td data-l="${t("f.produtos")}" class="c-prod">${productChips(l.produtos)}</td>
        <td data-l="${t("f.valor")}" class="num">${money(l.valor)}</td>
        <td data-l="Score">${scoreBadge(l)}</td>
        <td data-l="${t("task.next")}">${nt ? `<span class="nt">${esc(nt.titulo)}</span> ${dueChip(nt)}` : `<span class="muted">—</span>`}</td>
        <td data-l="${t("f.origem")}" class="muted">${esc(originLabel(l.origem))}</td>
        <td data-l="${t("lead.updatedAt")}" class="muted">${esc(relTime(l.atualizadoEm))}</td></tr>`;
    }).join("") || `<tr><td colspan="9"><div class="empty-state">${icon("users")}<p>${S.state.leads.length ? t("leads.noMatch") : t("leads.emptyAll")}</p>
      ${S.state.leads.length ? "" : `<div class="row center"><a class="btn" href="#prospectar">${icon("radar")}${t("dash.findLeads")}</a><button class="btn primary" data-action="new-lead">${icon("plus")}${t("lead.new")}</button></div>`}</div></td></tr>`;
    $("#ld_more", el).innerHTML = L.length > st.limit ? `<button class="btn">${t("leads.showMore").replace("{n}", L.length - st.limit)}</button>` : "";
    $("#ld_all", el).checked = shown.length > 0 && shown.every(l => st.sel.has(l.id));
    this.bulkBar(el);
  }
};
