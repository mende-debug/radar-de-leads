import { $, $$, esc, uid, todayISO, download, parseCSV, norm, CURRENCIES, COUNTRIES, regionName, lsGet, lsSet, fmtDateTime, splitList } from "../util.js";
import { t, getLang, LANGS, defaultTemplates } from "../i18n.js";
import * as S from "../store.js";
import * as Sync from "../sync.js";
import { icon, toast, openModal, confirmDialog } from "../ui.js";
import { money } from "../components.js";
import { gKey, setGKey } from "./prospect.js";

/* ---------- Importar CSV ---------- */
const MAP = {
  empresa: ["empresa", "company", "negocio", "business", "organization", "organizacao", "razaosocial", "nomefantasia", "account"],
  contato: ["contato", "contact", "nome", "name", "nombre", "fullname", "firstname", "pessoa"],
  telefone: ["telefone", "phone", "whatsapp", "celular", "mobile", "telefono", "fone", "tel"],
  email: ["email", "e-mail", "mail", "correo"], cidade: ["cidade", "city", "ciudad", "municipio"], pais: ["pais", "country"],
  segmento: ["segmento", "segment", "industry", "setor", "categoria", "category"], site: ["site", "website", "url", "web"],
  instagram: ["instagram", "insta"], valor: ["valor", "value", "amount", "deal", "preco", "price"], etapa: ["etapa", "stage", "status", "fase"],
  origem: ["origem", "source", "fonte", "origen"], tags: ["tags", "etiquetas", "labels"], notas: ["notas", "notes", "observacoes", "obs", "comentarios"], cargo: ["cargo", "title", "jobtitle", "role", "puesto"]
};
export function importCSVDialog() {
  openModal({
    title: t("data.importCsv"), size: "lg",
    body: `<div class="stack"><p class="muted sm">${t("data.csvHint")}</p>
      <label class="dropzone" id="csv_drop">${icon("upload")}<span>${t("data.csvPick")}</span><input type="file" id="csv_f" accept=".csv,text/csv" hidden></label>
      <div id="csv_prev"></div></div>`,
    footer: `<button class="btn" data-close>${t("common.cancel")}</button><button class="btn primary" id="csv_go" disabled>${t("data.import")}</button>`,
    onMount: (m, close) => {
      let rows = [];
      const handle = async f => {
        const txt = await f.text(); const data = parseCSV(txt.replace(/^﻿/, ""));
        if (data.length < 2) { toast(t("data.csvEmpty"), "warn"); return; }
        const head = data[0].map(h => norm(h).replace(/[^a-z-]/g, ""));
        const col = {}; for (const [f2, al] of Object.entries(MAP)) { const i = head.findIndex(h => al.includes(h)); if (i >= 0) col[f2] = i; }
        const st = S.cfg().etapas;
        rows = data.slice(1).map(r => {
          const g = k => (col[k] != null ? (r[col[k]] || "").trim() : "");
          const stg = st.find(s => norm(s.nome) === norm(g("etapa")) || s.id === norm(g("etapa")));
          return { empresa: g("empresa"), contato: g("contato"), telefone: g("telefone"), email: g("email"), cidade: g("cidade"), segmento: g("segmento"), site: g("site"),
            instagram: g("instagram"), cargo: g("cargo"), notas: g("notas"), valor: +String(g("valor")).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".") || 0,
            etapa: stg?.id, origem: g("origem") ? norm(g("origem")) : "importacao", tags: splitList(g("tags").replace(/\|/g, ",")), temSite: g("site") ? "sim" : "",
            pais: COUNTRIES.find(c => c === g("pais").toUpperCase()) || S.cfg().pais };
        }).filter(r => r.empresa || r.contato);
        $("#csv_prev", m).innerHTML = `<p><b>${t("data.csvFound").replace("{n}", rows.length)}</b></p><p class="muted sm">${t("data.csvCols")}: ${Object.keys(col).map(k => t("f." + k)).join(", ") || "—"}</p>
          <div class="table-wrap"><table class="tbl compact"><tbody>${rows.slice(0, 5).map(r => `<tr><td>${esc(r.empresa)}</td><td>${esc(r.contato)}</td><td>${esc(r.telefone)}</td><td>${esc(r.email)}</td><td>${esc(r.cidade)}</td></tr>`).join("")}</tbody></table></div>`;
        $("#csv_go", m.parentElement).disabled = !rows.length;
      };
      $("#csv_f", m).onchange = e => e.target.files[0] && handle(e.target.files[0]);
      const dz = $("#csv_drop", m);
      dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("over"); });
      dz.addEventListener("dragleave", () => dz.classList.remove("over"));
      dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("over"); e.dataTransfer.files[0] && handle(e.dataTransfer.files[0]); });
      $("#csv_go", m).onclick = () => { S.addLeads(rows); close(); toast(t("data.imported").replace("{n}", rows.length)); };
    }
  });
}

/* ---------- Tela de configurações ---------- */
export default {
  title: () => t("nav.config"),
  mount(el) {
    const c = S.cfg(), lang = getLang(), theme = lsGet("radar-crm-theme", "system");
    const counts = S.state.leads.reduce((m, l) => (m[l.etapa] = (m[l.etapa] || 0) + 1, m), {});
    el.innerHTML = `<div class="page-h"><div><h1>${t("nav.config")}</h1><p class="muted">${t("cfg.lede")}</p></div></div>
      <div class="cfg">
        <nav class="cfg-nav" aria-label="${t("nav.config")}">${["empresa", "funil", "produtos", "equipe", "integracoes", "dados"].map(k => `<button type="button" data-scroll="cfg-${k}">${t("cfg." + k)}</button>`).join("")}</nav>
        <div class="cfg-body">
          <section class="card" id="cfg-empresa"><header class="card-h"><h2>${t("cfg.empresa")}</h2></header>
            <div class="fgrid">
              <label class="field">${t("cfg.companyName")}<input id="c_empresa" value="${esc(c.empresa)}"></label>
              <label class="field">${t("cfg.yourName")}<input id="c_usuario" value="${esc(c.usuario)}"></label>
              <label class="field">${t("cfg.language")}<select id="c_idioma">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === lang ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>
              <label class="field">${t("cfg.currency")}<select id="c_moeda">${CURRENCIES.map(k => `<option ${k === c.moeda ? "selected" : ""}>${k}</option>`).join("")}</select></label>
              <label class="field">${t("cfg.country")}<select id="c_pais">${COUNTRIES.map(k => `<option value="${k}" ${k === c.pais ? "selected" : ""}>${esc(regionName(k, lang))}</option>`).join("")}</select></label>
              <label class="field">${t("cfg.whatsapp")}<input id="c_whatsapp" value="${esc(c.whatsapp)}" inputmode="tel" placeholder="+55 19 99999-9999"></label>
              <label class="field">${t("cfg.goal")} (${esc(c.moeda)})<input id="c_meta" type="number" min="0" value="${c.metaMensal || ""}"></label>
              <label class="field">${t("cfg.theme")}<select id="c_theme">${["system", "light", "dark"].map(k => `<option value="${k}" ${k === theme ? "selected" : ""}>${t("theme." + k)}</option>`).join("")}</select></label>
            </div>
            <div class="row end"><button class="btn primary" id="c_save1">${t("common.save")}</button></div></section>

          <section class="card" id="cfg-funil"><header class="card-h"><h2>${t("cfg.funil")}</h2><button class="btn sm" id="st_add">${icon("plus")}${t("cfg.addStage")}</button></header>
            <p class="muted sm">${t("cfg.funilHint")}</p>
            <ul class="edit-list" id="st_list">${c.etapas.map((s, i) => `<li data-i="${i}">
              <input type="color" value="${esc(s.cor)}" data-k="cor" aria-label="${t("cfg.color")}">
              <input value="${esc(s.nome)}" data-k="nome" aria-label="${t("cfg.stageName")}" class="grow">
              ${s.tipo ? `<span class="badge">${t("cfg.type." + s.tipo)}</span>` : `<label class="pct"><input type="number" min="0" max="100" value="${s.prob}" data-k="prob" aria-label="${t("cfg.prob")}">%</label>`}
              <span class="muted sm st-cnt">${counts[s.id] || 0} leads</span>
              <button class="icon-btn xs" data-up="${i}" aria-label="${t("cfg.up")}" ${i === 0 ? "disabled" : ""}>↑</button>
              <button class="icon-btn xs" data-down="${i}" aria-label="${t("cfg.down")}" ${i === c.etapas.length - 1 ? "disabled" : ""}>↓</button>
              ${s.tipo ? "<span></span>" : `<button class="icon-btn xs" data-rm="${i}" aria-label="${t("common.delete")}" ${counts[s.id] ? "disabled title='" + t("cfg.stageInUse") + "'" : ""}>${icon("trash")}</button>`}</li>`).join("")}</ul>
            <div class="row end"><button class="btn primary" id="st_save">${t("common.save")}</button></div></section>

          <section class="card" id="cfg-produtos"><header class="card-h"><h2>${t("cfg.produtos")}</h2><button class="btn sm" id="pr_add">${icon("plus")}${t("cfg.addProduct")}</button></header>
            <p class="muted sm">${t("cfg.prodHint")}</p>
            <ul class="edit-list" id="pr_list">${c.produtos.map((p, i) => `<li data-i="${i}">
              <input type="color" value="${esc(p.cor)}" data-k="cor" aria-label="${t("cfg.color")}">
              <input value="${esc(p.nome)}" data-k="nome" class="grow" aria-label="${t("cfg.prodName")}">
              <label class="pct">${esc(c.moeda)} <input type="number" min="0" step="any" value="${p.preco}" data-k="preco" aria-label="${t("cfg.price")}"></label>
              <select data-k="tipo" aria-label="${t("cfg.prodType")}">${["nfc", "site", "outro"].map(k => `<option value="${k}" ${p.tipo === k ? "selected" : ""}>${t("cfg.ptype." + k)}</option>`).join("")}</select>
              <button class="icon-btn xs" data-rm="${i}" aria-label="${t("common.delete")}">${icon("trash")}</button></li>`).join("")}</ul>
            <div class="row end"><button class="btn primary" id="pr_save">${t("common.save")}</button></div></section>

          <section class="card" id="cfg-equipe"><header class="card-h"><h2>${t("cfg.equipe")}</h2></header>
            <p class="muted sm">${t("cfg.teamHint")}</p>
            <div class="row"><input id="tm_new" placeholder="${t("cfg.teamPh")}" class="grow"><button class="btn" id="tm_add">${t("common.add")}</button></div>
            <ul class="pill-list">${(c.equipe || []).map((n, i) => `<li>${esc(n)} <button class="icon-btn xs" data-tm="${i}" aria-label="${t("common.remove")}">${icon("x")}</button></li>`).join("") || `<li class="muted sm">${t("cfg.teamEmpty")}</li>`}</ul></section>

          <section class="card" id="cfg-integracoes"><header class="card-h"><h2>${t("cfg.integracoes")}</h2></header>
            <div class="integ"><div class="integ-h">${icon("sync")}<div><b>${t("sync.title")}</b><p class="muted sm">${t("sync.desc")}</p></div><span class="badge" id="sy_badge"></span></div>
              <div id="sy_off" ${Sync.connected() ? "hidden" : ""}>
                <ol class="steps-ol"><li>${t("sync.s1").replace("{a}", '<a href="https://github.com/settings/tokens/new?scopes=gist&description=Radar%20CRM" target="_blank" rel="noopener">' + t("sync.createToken") + "</a>")}</li><li>${t("sync.s2")}</li></ol>
                <div class="row"><input id="sy_tok" type="password" autocomplete="off" placeholder="ghp_…" class="grow" aria-label="GitHub token"><button class="btn primary" id="sy_on">${t("sync.connect")}</button></div></div>
              <div id="sy_on_box" ${Sync.connected() ? "" : "hidden"}><p class="muted sm" id="sy_info"></p>
                <div class="row"><button class="btn sm" id="sy_now">${icon("sync")}${t("sync.now")}</button><button class="btn sm ghost" id="sy_off_btn">${t("sync.disconnect")}</button></div></div></div>
            <div class="integ"><div class="integ-h">${icon("map")}<div><b>Google Places API</b><p class="muted sm">${t("prosp.keyIntro")}</p></div><span class="badge ${gKey() ? "ok" : ""}">${gKey() ? t("prosp.keyOk") : t("prosp.keyMissing")}</span></div>
              <div class="row"><input id="gk" type="password" autocomplete="off" placeholder="AIza…" class="grow" aria-label="Google API key"><button class="btn" id="gk_save">${t("common.save")}</button>${gKey() ? `<button class="btn ghost" id="gk_del">${t("common.remove")}</button>` : ""}</div>
              <p class="muted sm"><a href="#prospectar">${t("cfg.keySteps")}</a></p></div></section>

          <section class="card" id="cfg-dados"><header class="card-h"><h2>${t("cfg.dados")}</h2></header>
            <div class="data-actions">
              <button class="btn" id="dt_bk">${icon("download")}${t("data.backup")}</button>
              <label class="btn" for="dt_rs">${icon("upload")}${t("data.restore")}</label><input type="file" id="dt_rs" accept=".json,application/json" hidden>
              <button class="btn" id="dt_imp">${icon("upload")}${t("data.importCsv")}</button>
              <button class="btn" id="dt_tpl">${icon("message")}${t("data.resetTpl")}</button>
              <button class="btn" id="dt_demo">${icon("tag")}${t("data.removeDemo")}</button>
              <button class="btn danger" id="dt_wipe">${icon("trash")}${t("data.wipe")}</button>
            </div>
            <p class="muted sm">${t("data.stats").replace("{n}", S.state.leads.length).replace("{a}", S.state.leads.reduce((s, l) => s + l.atividades.length, 0))}</p></section>
        </div></div>`;

    $(".cfg-nav", el).onclick = e => { const b = e.target.closest("[data-scroll]"); if (b) $("#" + b.dataset.scroll, el)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const v = id => $("#" + id, el).value.trim();
    $("#c_save1", el).onclick = () => {
      const newLang = v("c_idioma");
      S.updateConfig({ empresa: v("c_empresa") || "Radar", usuario: v("c_usuario"), moeda: v("c_moeda"), pais: v("c_pais"), whatsapp: v("c_whatsapp"), metaMensal: +v("c_meta") || 0, idioma: newLang });
      lsSet("radar-crm-theme", v("c_theme")); window.dispatchEvent(new Event("themechange"));
      if (newLang !== getLang()) { lsSet("radar-crm-lang", newLang); location.reload(); return; }
      toast(t("common.saved")); window.dispatchEvent(new Event("brand"));
    };
    // Etapas
    let etapas = c.etapas.map(s => ({ ...s }));
    const readList = (sel, arr) => $$(sel + " li", el).forEach(li => { const o = arr[+li.dataset.i]; $$("[data-k]", li).forEach(inp => { o[inp.dataset.k] = inp.type === "number" ? +inp.value : inp.value; }); });
    $("#st_list", el).onclick = e => {
      const up = e.target.closest("[data-up]"), dn = e.target.closest("[data-down]"), rm = e.target.closest("[data-rm]");
      if (!up && !dn && !rm) return;
      readList("#st_list", etapas);
      if (up) { const i = +up.dataset.up; [etapas[i - 1], etapas[i]] = [etapas[i], etapas[i - 1]]; }
      if (dn) { const i = +dn.dataset.down; [etapas[i + 1], etapas[i]] = [etapas[i], etapas[i + 1]]; }
      if (rm) etapas.splice(+rm.dataset.rm, 1);
      S.updateConfig({ etapas }); this.mount(el); $("#cfg-funil", el)?.scrollIntoView({ block: "start" });
    };
    $("#st_add", el).onclick = () => { readList("#st_list", etapas); const i = etapas.findIndex(s => s.tipo); etapas.splice(i < 0 ? etapas.length : i, 0, { id: uid("st"), nome: t("cfg.newStage"), prob: 50, cor: "#5C7CFA" }); S.updateConfig({ etapas }); this.mount(el); };
    $("#st_save", el).onclick = () => { readList("#st_list", etapas); S.updateConfig({ etapas }); toast(t("common.saved")); };
    // Produtos
    let produtos = c.produtos.map(p => ({ ...p }));
    $("#pr_list", el).onclick = async e => {
      const rm = e.target.closest("[data-rm]"); if (!rm) return;
      const p = produtos[+rm.dataset.rm], used = S.state.leads.filter(l => l.produtos.includes(p.id)).length;
      if (used && !(await confirmDialog(t("cfg.prodInUse").replace("{n}", used), { ok: t("common.delete"), danger: true }))) return;
      readList("#pr_list", produtos); produtos.splice(+rm.dataset.rm, 1); S.updateConfig({ produtos }); this.mount(el);
    };
    $("#pr_add", el).onclick = () => { readList("#pr_list", produtos); produtos.push({ id: uid("p"), nome: t("cfg.newProduct"), preco: 0, cor: "#1098AD", tipo: "outro" }); S.updateConfig({ produtos }); this.mount(el); };
    $("#pr_save", el).onclick = () => { readList("#pr_list", produtos); S.updateConfig({ produtos }); toast(t("common.saved")); };
    // Equipe
    $("#tm_add", el).onclick = () => { const n = v("tm_new"); if (!n) return; S.updateConfig({ equipe: [...new Set([...(c.equipe || []), n])] }); this.mount(el); };
    $("#tm_new", el).addEventListener("keydown", e => { if (e.key === "Enter") $("#tm_add", el).click(); });
    $(".pill-list", el).onclick = e => { const b = e.target.closest("[data-tm]"); if (!b) return; S.updateConfig({ equipe: c.equipe.filter((_, i) => i !== +b.dataset.tm) }); this.mount(el); };
    // Sync
    const paint = st => {
      const b = $("#sy_badge", el); if (!b) return;
      const map = { off: ["", t("sync.off")], ok: ["ok", t("sync.on")], busy: ["warn", t("sync.busy")], pending: ["warn", t("sync.pending")], error: ["bad", t("sync.error")] };
      const [cls, lbl] = map[st.state] || map.off; b.className = "badge " + cls; b.textContent = lbl;
      $("#sy_off", el).hidden = Sync.connected(); $("#sy_on_box", el).hidden = !Sync.connected();
      $("#sy_info", el).textContent = st.state === "error" ? st.msg : st.last ? t("sync.last").replace("{d}", fmtDateTime(st.last)) : "";
    };
    this.unsub?.(); this.unsub = Sync.onStatus(paint); paint(Sync.status);
    $("#sy_on", el).onclick = async () => { const tok = v("sy_tok"); if (!tok) return; try { await Sync.connect(tok); toast(t("sync.connected")); this.mount(el); } catch (e) { toast(e.message, "warn"); } };
    $("#sy_now", el).onclick = () => Sync.run();
    $("#sy_off_btn", el).onclick = () => { Sync.disconnect(); toast(t("sync.disconnected")); };
    // Google
    $("#gk_save", el).onclick = () => { const k = v("gk"); if (!k) return; setGKey(k); toast(t("prosp.keySaved")); this.mount(el); };
    $("#gk_del", el)?.addEventListener("click", () => { setGKey(""); this.mount(el); });
    // Dados
    $("#dt_bk", el).onclick = () => { download(`radar-crm-backup-${todayISO()}.json`, JSON.stringify({ app: "radar-crm", versao: 2, exportadoEm: new Date().toISOString(), ...S.state }, null, 2), "application/json"); toast(t("data.backupDone")); };
    $("#dt_rs", el).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const d = JSON.parse(await f.text()); const leads = Array.isArray(d) ? d : d.leads; if (!Array.isArray(leads)) throw 0;
        if (!(await confirmDialog(t("data.restoreConfirm").replace("{n}", leads.length), { ok: t("data.restore") }))) return;
        const byId = new Map(S.state.leads.map(l => [l.id, l]));
        leads.forEach(l => { const m = S.normalizeLead(S.migrateLead(l)); if (m.id) byId.set(m.id, m); });
        S.replaceAll({ leads: [...byId.values()], removidos: S.state.removidos, config: d.config || S.state.config, configAt: d.configAt });
        toast(t("data.restored").replace("{n}", leads.length)); this.mount(el);
      } catch { toast(t("data.invalid"), "warn"); }
      e.target.value = "";
    };
    $("#dt_imp", el).onclick = () => importCSVDialog();
    $("#dt_tpl", el).onclick = async () => { if (await confirmDialog(t("data.resetTplConfirm"))) { S.updateConfig({ templates: defaultTemplates(getLang()) }); toast(t("common.saved")); } };
    $("#dt_demo", el).onclick = () => { const ids = S.state.leads.filter(l => (l.tags || []).includes("exemplo")).map(l => l.id); if (!ids.length) { toast(t("data.noDemo")); return; } S.deleteLeads(ids); toast(t("bulk.deleted").replace("{n}", ids.length)); this.mount(el); };
    $("#dt_wipe", el).onclick = async () => { if (await confirmDialog(t("data.wipeConfirm"), { ok: t("data.wipe"), danger: true })) { S.deleteLeads(S.state.leads.map(l => l.id)); toast(t("data.wiped")); this.mount(el); } };
  },
  unmount() { this.unsub?.(); }
};
