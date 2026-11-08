import { $, $$, esc, waUrl, copyText, uid, intlPhone, getLocale } from "../util.js";
import { t } from "../i18n.js";
import * as S from "../store.js";
import { icon, toast, openModal, confirmDialog } from "../ui.js";

let leadId = "", tplId = "";
addEventListener("compose", e => { leadId = e.detail; tplId = ""; });

const VARS = ["contato", "empresa", "cidade", "segmento", "avaliacoes", "produto", "valor", "minha_empresa", "meu_nome"];
export function fill(text, l) {
  const c = S.cfg(), first = (l?.contato || "").split(" ")[0];
  const map = {
    contato: first, empresa: l ? S.leadName(l) : t("msg.yourBusiness"), cidade: l?.cidade || "", segmento: l?.segmento || "",
    avaliacoes: l?.avaliacoes ?? "", produto: (l?.produtos || []).map(id => S.product(id)?.nome).filter(Boolean).join(" + "),
    valor: l?.valor ? new Intl.NumberFormat(getLocale(), { style: "currency", currency: c.moeda, maximumFractionDigits: 0 }).format(l.valor) : "", minha_empresa: c.empresa || "", meu_nome: c.usuario || ""
  };
  if (!first) text = text.replace(/,? ?\{contato\}/g, "");
  if (l?.avaliacoes == null) text = text.replace(/ ?e reparei que vocês têm \{avaliacoes\} avaliações| ?and noticed you have \{avaliacoes\} reviews| ?y noté que tienen \{avaliacoes\} reseñas/g, "");
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m)).replace(/[ \t]{2,}/g, " ");
}
function suggested(l) {
  const tps = S.cfg().templates; if (!l) return tps[0];
  const i = S.stageIndex(l.etapa), stageKey = ["primeiro", "followup", "followup", "proposta", "fechamento"][Math.min(i, 4)];
  return tps.find(x => l.produtos.includes(x.produto) && x.momento === stageKey) || tps.find(x => l.produtos.includes(x.produto)) || tps[0];
}

export default {
  title: () => t("nav.mensagens"),
  mount(el) {
    el.innerHTML = `<div class="page-h"><div><h1>${t("nav.mensagens")}</h1><p class="muted">${t("msg.lede")}</p></div>
      <button class="btn" id="mg_new">${icon("plus")}${t("msg.newTpl")}</button></div>
      <div class="msg-grid">
        <section class="card stack">
          <label class="field">${t("msg.lead")}<select id="mg_lead"></select></label>
          <div class="field"><span>${t("msg.template")}</span><div class="tpl-list" id="mg_tpls" role="listbox"></div></div>
        </section>
        <section class="card stack">
          <header class="card-h"><h2>${t("msg.preview")}</h2><span class="muted sm" id="mg_to"></span></header>
          <textarea id="mg_text" rows="10" class="msg-text" aria-label="${t("msg.preview")}"></textarea>
          <div class="row wrap">
            <a class="btn wa" id="mg_wa" target="_blank" rel="noopener" href="#">${icon("whatsapp")}${t("msg.openWa")}</a>
            <a class="btn" id="mg_mail" href="#">${icon("mail")}E-mail</a>
            <button class="btn" id="mg_copy">${icon("copy")}${t("common.copy")}</button>
            <button class="btn primary" id="mg_log">${icon("check")}${t("msg.logSent")}</button>
          </div>
          <p class="muted sm">${t("msg.logHint")}</p>
        </section>
      </div>`;
    $("#mg_lead", el).onchange = e => { leadId = e.target.value; tplId = ""; this.refresh(el, true); };
    $("#mg_tpls", el).onclick = e => {
      const ed = e.target.closest("[data-edit]"); if (ed) { e.stopPropagation(); this.editTpl(el, ed.dataset.edit); return; }
      const b = e.target.closest("[data-tpl]"); if (b) { tplId = b.dataset.tpl; this.refresh(el, true); }
    };
    $("#mg_new", el).onclick = () => this.editTpl(el, null);
    $("#mg_text", el).addEventListener("input", () => this.links(el));
    $("#mg_copy", el).onclick = async () => { toast((await copyText($("#mg_text", el).value)) ? t("common.copied") : t("common.copyFail")); };
    const log = canal => { const l = S.getLead(leadId); if (!l) { toast(t("msg.pickLead"), "warn"); return false; } S.logOutreach(l.id, canal, $("#mg_text", el).value.slice(0, 140)); return true; };
    $("#mg_wa", el).addEventListener("click", () => { if (S.getLead(leadId)) setTimeout(() => { log("whatsapp"); toast(t("msg.logged")); }, 400); });
    $("#mg_mail", el).addEventListener("click", () => { if (S.getLead(leadId)) setTimeout(() => log("email"), 400); });
    $("#mg_log", el).onclick = () => { if (log("whatsapp")) toast(t("msg.logged")); };
    this.refresh(el, true);
  },
  refresh(el, rebuildText = false) {
    const c = S.cfg(), L = [...S.state.leads].filter(S.isOpen).sort((a, b) => S.leadName(a).localeCompare(S.leadName(b)));
    if (leadId && !S.getLead(leadId)) leadId = "";
    const l = S.getLead(leadId);
    $("#mg_lead", el).innerHTML = `<option value="">${t("msg.noLead")}</option>` + L.map(x => `<option value="${esc(x.id)}" ${x.id === leadId ? "selected" : ""}>${esc(S.leadName(x))} · ${esc(S.stage(x.etapa).nome)}</option>`).join("");
    if (!tplId || !c.templates.find(x => x.id === tplId)) tplId = suggested(l)?.id || "";
    const groups = c.produtos.map(p => [p, c.templates.filter(x => x.produto === p.id)]).concat([[{ id: "", nome: t("msg.general"), cor: "var(--muted)" }, c.templates.filter(x => !S.product(x.produto))]]).filter(g => g[1].length);
    $("#mg_tpls", el).innerHTML = groups.map(([p, tps]) => `<div class="tpl-g"><span class="tpl-gh"><i class="dot" style="--c:${esc(p.cor)}"></i>${esc(p.nome)}</span>
      ${tps.map(x => `<div class="tpl ${x.id === tplId ? "on" : ""}" data-tpl="${esc(x.id)}" role="option" aria-selected="${x.id === tplId}" tabindex="0"><span>${esc(x.nome)}</span><button class="icon-btn xs" data-edit="${esc(x.id)}" aria-label="${t("common.edit")}">${icon("edit")}</button></div>`).join("")}</div>`).join("") || `<p class="empty">${t("msg.noTpl")}</p>`;
    if (rebuildText) { const tp = c.templates.find(x => x.id === tplId); $("#mg_text", el).value = tp ? fill(tp.texto, l) : ""; }
    $("#mg_to", el).textContent = l ? (l.telefone ? "+" + intlPhone(l.telefone, l.pais) : t("msg.noPhone")) : "";
    this.links(el);
  },
  links(el) {
    const l = S.getLead(leadId), txt = $("#mg_text", el).value;
    $("#mg_wa", el).href = l?.telefone ? waUrl(l.telefone, l.pais, txt) : "https://wa.me/?text=" + encodeURIComponent(txt);
    $("#mg_mail", el).href = `mailto:${encodeURIComponent(l?.email || "")}?body=${encodeURIComponent(txt)}`;
  },
  editTpl(el, id) {
    const c = S.cfg(), tp = id ? c.templates.find(x => x.id === id) : { id: uid("tp"), nome: "", produto: c.produtos[0]?.id || "", momento: "primeiro", texto: "" };
    openModal({
      title: id ? t("msg.editTpl") : t("msg.newTpl"), size: "lg",
      body: `<div class="form"><div class="fgrid">
        <label class="field span2">${t("msg.tplName")}<input id="tp_n" value="${esc(tp.nome)}" autofocus></label>
        <label class="field">${t("f.produtos")}<select id="tp_p"><option value="">${t("msg.general")}</option>${c.produtos.map(p => `<option value="${esc(p.id)}" ${p.id === tp.produto ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select></label>
        <label class="field">${t("msg.moment")}<select id="tp_m">${["primeiro", "followup", "proposta", "fechamento", "outro"].map(k => `<option value="${k}" ${k === tp.momento ? "selected" : ""}>${t("msg.m." + k)}</option>`).join("")}</select></label>
        <label class="field span2">${t("msg.text")}<textarea id="tp_t" rows="9">${esc(tp.texto)}</textarea></label></div>
        <div class="vars"><span class="muted sm">${t("msg.vars")}</span>${VARS.map(v => `<button type="button" class="chip-btn" data-var="${v}">{${v}}</button>`).join("")}</div></div>`,
      footer: `${id ? `<button class="btn danger ghost" id="tp_del">${icon("trash")}${t("common.delete")}</button><span class="grow"></span>` : ""}<button class="btn" data-close>${t("common.cancel")}</button><button class="btn primary" id="tp_save">${t("common.save")}</button>`,
      onMount: (m, close) => {
        m.querySelector(".vars").onclick = e => { const b = e.target.closest("[data-var]"); if (!b) return; const ta = $("#tp_t", m), s = ta.selectionStart; ta.setRangeText("{" + b.dataset.var + "}", s, ta.selectionEnd, "end"); ta.focus(); };
        $("#tp_save", m).onclick = () => {
          const n = { ...tp, nome: $("#tp_n", m).value.trim(), produto: $("#tp_p", m).value, momento: $("#tp_m", m).value, texto: $("#tp_t", m).value };
          if (!n.nome || !n.texto.trim()) { toast(t("msg.tplNeed"), "warn"); return; }
          S.updateConfig({ templates: id ? c.templates.map(x => (x.id === id ? n : x)) : [...c.templates, n] });
          tplId = n.id; close(); toast(t("common.saved")); this.refresh(el, true);
        };
        $("#tp_del", m)?.addEventListener("click", async () => { if (await confirmDialog(t("msg.confirmDel"), { ok: t("common.delete"), danger: true })) { S.updateConfig({ templates: c.templates.filter(x => x.id !== id) }); tplId = ""; close(); this.refresh(el, true); } });
      }
    });
  }
};
