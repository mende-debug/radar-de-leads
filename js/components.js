// Peças reutilizáveis do CRM: selos, formulário de lead e painel lateral do lead.
import { $, $$, esc, fmtMoney, fmtDate, relTime, todayISO, addDays, waUrl, intlPhone, splitList, norm, COUNTRIES, regionName, fmtDateTime } from "./util.js";
import { t, getLang } from "./i18n.js";
import * as S from "./store.js";
import { icon, openModal, openDrawer, toast, confirmDialog } from "./ui.js";

export const stageBadge = id => { const s = S.stage(id); return `<span class="badge stage" style="--c:${esc(s?.cor)}">${esc(s?.nome || id)}</span>`; };
export const productChips = ids => (ids || []).map(id => { const p = S.product(id); return p ? `<span class="pchip" style="--c:${esc(p.cor)}">${esc(p.nome)}</span>` : ""; }).join("");
export function scoreBadge(l) {
  const sc = S.score(l), h = S.heat(sc);
  return `<span class="score ${h}" title="${t("score.title")}: ${sc}/100 · ${t("score." + h)}">${h === "hot" ? icon("flame") : ""}<b>${sc}</b></span>`;
}
export const initials = s => (String(s || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("") || "?").toUpperCase();
export function avatar(l, size = "") {
  const name = S.leadName(l); let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="avatar ${size}" style="--h:${h}">${esc(initials(name))}</span>`;
}
export function dueChip(task) {
  if (!task) return "";
  const td = todayISO(), cls = task.vence < td ? "late" : task.vence === td ? "today" : "";
  return `<span class="due ${cls}">${icon("clock")}${esc(task.vence < td ? t("task.late") + " · " + fmtDate(task.vence) : task.vence === td ? t("task.today") : fmtDate(task.vence))}</span>`;
}
export const money = v => fmtMoney(v, S.cfg().moeda);
export const originLabel = o => t("origem." + o) !== "origem." + o ? t("origem." + o) : o;

/* ---------- Leitura de mensagem de captação ---------- */
const LABELS = {
  contato: ["nome", "name", "nombre", "contato", "contact", "contacto"],
  empresa: ["empresa", "company", "negocio", "business", "compania"],
  telefone: ["whatsapp", "telefone", "phone", "telefono", "celular", "fone", "tel"],
  email: ["email", "e-mail", "correo"],
  cidade: ["cidade", "city", "ciudad"],
  notas: ["mensagem", "message", "mensaje", "obs", "observacoes"],
  produto: ["produto", "product", "producto", "interesse", "interest", "interes"]
};
export function parseCapture(text) {
  const out = {};
  for (const line of String(text).split(/\n/)) {
    const m = line.replace(/[*_]/g, "").match(/^\s*([^:]{2,24}):\s*(.+)$/); if (!m) continue;
    const k = norm(m[1]).replace(/[^a-z-]/g, "");
    for (const [field, labels] of Object.entries(LABELS)) if (labels.includes(k)) out[field] = m[2].trim();
  }
  if (out.produto) {
    const p = S.cfg().produtos.find(p => norm(out.produto).includes(norm(p.nome)) || norm(p.nome).includes(norm(out.produto)));
    if (p) out.produtos = [p.id];
    delete out.produto;
  }
  return out;
}

/* ---------- Formulário de lead (criar / editar) ---------- */
export function leadForm(lead, { onSaved } = {}) {
  const c = S.cfg(), isNew = !lead;
  const l = lead ? { ...lead } : S.normalizeLead({ origem: "outro", responsavel: c.usuario || "" });
  const lang = getLang();
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(label)}</option>`;
  const team = [...new Set([...(c.equipe || []), c.usuario].filter(Boolean))];
  const body = `<form id="lf" class="form" novalidate>
    ${isNew ? `<details class="paste"><summary>${icon("magnet")} ${t("form.pasteCapture")}</summary>
      <div class="stack-sm"><textarea id="lf_paste" rows="4" placeholder="${t("form.pasteHint")}"></textarea>
      <button type="button" class="btn sm" id="lf_parse">${t("form.fillFromText")}</button></div></details>` : ""}
    <div class="fgrid">
      <label class="field span2">${t("f.empresa")}<input id="f_empresa" value="${esc(l.empresa)}" autocomplete="organization" ${isNew ? "autofocus" : ""}></label>
      <label class="field">${t("f.contato")}<input id="f_contato" value="${esc(l.contato)}" autocomplete="name"></label>
      <label class="field">${t("f.cargo")}<input id="f_cargo" value="${esc(l.cargo)}"></label>
      <label class="field">${t("f.telefone")}<input id="f_telefone" value="${esc(l.telefone)}" inputmode="tel" autocomplete="tel"></label>
      <label class="field">${t("f.email")}<input id="f_email" type="email" value="${esc(l.email)}" autocomplete="email"></label>
      <label class="field">${t("f.pais")}<select id="f_pais">${COUNTRIES.map(k => opt(k, regionName(k, lang), l.pais === k)).join("")}</select></label>
      <label class="field">${t("f.cidade")}<input id="f_cidade" value="${esc(l.cidade)}"></label>
      <label class="field">${t("f.segmento")}<input id="f_segmento" value="${esc(l.segmento)}"></label>
      <label class="field">${t("f.site")}<input id="f_site" value="${esc(l.site)}" placeholder="https://"></label>
      <label class="field">${t("f.instagram")}<input id="f_instagram" value="${esc(l.instagram)}" placeholder="@"></label>
      <label class="field">${t("f.temSite")}<select id="f_temSite">${opt("", t("common.unknown"), !l.temSite)}${opt("nao", t("common.no"), l.temSite === "nao")}${opt("sim", t("common.yes"), l.temSite === "sim")}</select></label>
    </div>
    <fieldset class="field"><legend>${t("f.produtos")}</legend><div class="chips-pick">
      ${c.produtos.map(p => `<label class="pick" style="--c:${esc(p.cor)}"><input type="checkbox" name="prod" value="${esc(p.id)}" ${l.produtos.includes(p.id) ? "checked" : ""}><span>${esc(p.nome)} <small>${money(p.preco)}</small></span></label>`).join("")}
    </div></fieldset>
    <div class="fgrid">
      <label class="field">${t("f.etapa")}<select id="f_etapa">${c.etapas.map(s => opt(s.id, s.nome, l.etapa === s.id)).join("")}</select></label>
      <label class="field">${t("f.valor")} (${esc(c.moeda)})<input id="f_valor" type="number" min="0" step="any" inputmode="decimal" value="${l.valor || ""}" placeholder="${S.productsValue(l.produtos) || ""}"></label>
      <label class="field">${t("f.responsavel")}<input id="f_responsavel" list="teamList" value="${esc(l.responsavel)}"><datalist id="teamList">${team.map(n => `<option value="${esc(n)}">`).join("")}</datalist></label>
      <label class="field">${t("f.origem")}<select id="f_origem">${c.origens.map(o => opt(o, originLabel(o), l.origem === o)).join("")}</select></label>
      <label class="field span2">${t("f.tags")}<input id="f_tags" value="${esc((l.tags || []).join(", "))}" placeholder="${t("f.tagsHint")}"></label>
      ${isNew ? `<label class="field span2">${t("f.firstTask")}<div class="row-in"><input id="f_task" value="${esc(t("task.firstContact"))}"><input id="f_taskDate" type="date" value="${todayISO()}" style="max-width:170px"></div></label>` : ""}
      <label class="field span2">${t("f.notas")}<textarea id="f_notas" rows="3">${esc(l.notas)}</textarea></label>
    </div>
  </form>`;
  openModal({
    title: isNew ? t("lead.new") : t("lead.edit"), size: "lg", body,
    footer: `<button class="btn" data-close>${t("common.cancel")}</button><button class="btn primary" id="lf_save">${isNew ? t("lead.create") : t("common.save")}</button>`,
    onMount: (m, close) => {
      const sync = () => { const ids = $$('input[name="prod"]:checked', m).map(i => i.value); $("#f_valor", m).placeholder = S.productsValue(ids) || ""; };
      $$('input[name="prod"]', m).forEach(i => i.addEventListener("change", sync));
      $("#lf_parse", m)?.addEventListener("click", () => {
        const d = parseCapture($("#lf_paste", m).value);
        if (!Object.keys(d).length) { toast(t("form.parseFail"), "warn"); return; }
        for (const k of ["contato", "empresa", "telefone", "email", "cidade", "notas"]) if (d[k]) $("#f_" + k, m).value = d[k];
        if (d.produtos) $$('input[name="prod"]', m).forEach(i => (i.checked = d.produtos.includes(i.value)));
        $("#f_origem", m).value = "captacao"; sync();
        m.querySelector("details.paste").open = false; toast(t("form.parsed"));
      });
      const save = () => {
        const v = id => $("#f_" + id, m).value.trim();
        const data = {
          ...l, empresa: v("empresa"), contato: v("contato"), cargo: v("cargo"), telefone: v("telefone"), email: v("email"), pais: v("pais"),
          cidade: v("cidade"), segmento: v("segmento"), site: v("site"), instagram: v("instagram"), temSite: v("temSite"),
          produtos: $$('input[name="prod"]:checked', m).map(i => i.value), etapa: v("etapa"), responsavel: v("responsavel"),
          origem: v("origem"), tags: splitList(v("tags")), notas: v("notas")
        };
        data.valor = v("valor") === "" ? S.productsValue(data.produtos) : +v("valor");
        if (!data.empresa && !data.contato) { toast(t("form.needName"), "warn"); $("#f_empresa", m).focus(); return; }
        if (data.site && data.temSite === "") data.temSite = "sim";
        let saved;
        if (isNew) {
          saved = S.createLead(data);
          const tk = $("#f_task", m).value.trim();
          if (tk) saved.tarefas.push({ id: "t" + Date.now().toString(36), titulo: tk, vence: $("#f_taskDate", m).value || todayISO(), feita: false });
          S.persist();
        } else saved = S.saveLead(data);
        close(); toast(isNew ? t("lead.created") : t("common.saved")); onSaved?.(saved);
      };
      $("#lf_save", m.parentElement).onclick = save;
      m.addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); });
    }
  });
}

/* ---------- Painel lateral do lead ---------- */
const ACT_ICON = { nota: "note", ligacao: "phone", whatsapp: "whatsapp", email: "mail", reuniao: "calendar", etapa: "arrow", criado: "sparkle", tarefa: "check", proposta: "trophy" };
export function openLead(id, { tab = "atividade" } = {}) {
  let cur = tab, unsub = null;
  const d = openDrawer((el, close) => {
    const l = S.getLead(id);
    if (!l) { close(); return; }
    const c = S.cfg(), nt = S.nextTask(l), lang = getLang();
    const wa = l.telefone ? waUrl(l.telefone, l.pais) : "";
    el.innerHTML = `
      <header class="dr-h">
        ${avatar(l, "lg")}
        <div class="dr-title"><h2>${esc(S.leadName(l))}</h2>
          <p class="muted">${esc([l.contato && l.empresa ? l.contato : "", l.cargo, l.cidade, l.pais && l.pais !== c.pais ? regionName(l.pais, lang) : ""].filter(Boolean).join(" · ") || t("lead.noDetails"))}</p></div>
        <button class="icon-btn" data-x aria-label="${t("common.close")}">${icon("x")}</button>
      </header>
      <div class="dr-meta">
        <label class="stage-select" style="--c:${esc(S.stage(l.etapa).cor)}"><span class="sr">${t("f.etapa")}</span>
          <select id="dr_stage">${c.etapas.map(s => `<option value="${esc(s.id)}" ${s.id === l.etapa ? "selected" : ""}>${esc(s.nome)}</option>`).join("")}</select></label>
        ${scoreBadge(l)}
        <span class="dr-val">${money(l.valor)}</span>
        ${productChips(l.produtos)}
      </div>
      <div class="dr-actions">
        ${wa ? `<a class="btn sm wa" href="${esc(wa)}" target="_blank" rel="noopener" data-log="whatsapp">${icon("whatsapp")}WhatsApp</a>` : ""}
        ${l.telefone ? `<a class="btn sm" href="tel:+${esc(intlPhone(l.telefone, l.pais))}" data-log="ligacao">${icon("phone")}${t("act.call")}</a>` : ""}
        ${l.email ? `<a class="btn sm" href="mailto:${esc(l.email)}" data-log="email">${icon("mail")}E-mail</a>` : ""}
        <a class="btn sm" href="#mensagens" data-compose>${icon("message")}${t("act.compose")}</a>
        <button class="btn sm" data-edit>${icon("edit")}${t("common.edit")}</button>
        <button class="icon-btn" data-del title="${t("common.delete")}" aria-label="${t("common.delete")}">${icon("trash")}</button>
      </div>
      ${nt ? `<div class="dr-next">${icon("calendar")}<span><b>${t("task.next")}:</b> ${esc(nt.titulo)}</span>${dueChip(nt)}</div>` : ""}
      <nav class="tabs-in" role="tablist">
        ${["atividade", "tarefas", "detalhes"].map(k => `<button role="tab" data-tab="${k}" aria-selected="${cur === k}">${t("dr." + k)}${k === "tarefas" && l.tarefas.filter(x => !x.feita).length ? ` <span class="count">${l.tarefas.filter(x => !x.feita).length}</span>` : ""}</button>`).join("")}
      </nav>
      <div class="dr-body" id="dr_body"></div>`;
    const body = $("#dr_body", el);
    if (cur === "atividade") {
      const acts = [...l.atividades].sort((a, b) => b.em.localeCompare(a.em));
      body.innerHTML = `<div class="composer">
          <div class="seg sm" id="act_type" role="group">${["nota", "ligacao", "whatsapp", "email", "reuniao"].map((k, i) => `<button type="button" data-k="${k}" aria-pressed="${i === 0}">${icon(ACT_ICON[k])}<span>${t("actType." + k)}</span></button>`).join("")}</div>
          <textarea id="act_txt" rows="2" placeholder="${t("act.placeholder")}"></textarea>
          <div class="row end"><button class="btn primary sm" id="act_add">${t("act.log")}</button></div></div>
        <ol class="timeline">${acts.map(a => `<li><span class="tl-ic ${esc(a.tipo)}">${icon(ACT_ICON[a.tipo] || "note")}</span>
          <div class="tl-b"><p><b>${t("actType." + a.tipo)}</b>${a.texto ? ` · <span class="tl-t">${esc(a.texto)}</span>` : ""}</p><time title="${esc(fmtDateTime(a.em))}">${esc(relTime(a.em))}</time></div>
          ${["nota", "ligacao", "whatsapp", "email", "reuniao"].includes(a.tipo) ? `<button class="icon-btn xs" data-rmact="${esc(a.id)}" aria-label="${t("common.delete")}">${icon("x")}</button>` : ""}</li>`).join("") || `<li class="empty">${t("act.empty")}</li>`}</ol>`;
      let type = "nota";
      $("#act_type", body).onclick = e => { const b = e.target.closest("button"); if (!b) return; type = b.dataset.k; $$("#act_type button", body).forEach(x => x.setAttribute("aria-pressed", x === b)); };
      $("#act_add", body).onclick = () => { const v = $("#act_txt", body).value.trim(); if (!v && type === "nota") return; S.addActivity(id, type, v); toast(t("act.logged")); };
      $("#act_txt", body).addEventListener("keydown", e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("#act_add", body).click(); });
    } else if (cur === "tarefas") {
      const open = l.tarefas.filter(x => !x.feita).sort((a, b) => (a.vence || "").localeCompare(b.vence || "")), done = l.tarefas.filter(x => x.feita);
      const quick = [[t("task.followup"), 2], [t("task.sendProposal"), 1], [t("task.call"), 0], [t("task.meeting"), 7]];
      body.innerHTML = `<form class="task-add" id="tk_form"><input id="tk_t" placeholder="${t("task.placeholder")}" aria-label="${t("task.placeholder")}"><input id="tk_d" type="date" value="${addDays(todayISO(), 1)}" aria-label="${t("task.due")}"><button class="btn primary sm">${t("common.add")}</button></form>
        <div class="quick">${quick.map(([q, n]) => `<button type="button" class="chip-btn" data-q="${esc(q)}" data-n="${n}">${esc(q)} · ${n === 0 ? t("task.today") : "+" + n + "d"}</button>`).join("")}</div>
        <ul class="tasks">${open.map(k => taskRow(k)).join("") || `<li class="empty">${t("task.none")}</li>`}</ul>
        ${done.length ? `<details class="done"><summary>${t("task.done")} (${done.length})</summary><ul class="tasks">${done.map(k => taskRow(k)).join("")}</ul></details>` : ""}`;
      $("#tk_form", body).onsubmit = e => { e.preventDefault(); const v = $("#tk_t", body).value.trim(); if (!v) return; S.addTask(id, v, $("#tk_d", body).value); };
      $(".quick", body).onclick = e => { const b = e.target.closest("[data-q]"); if (b) S.addTask(id, b.dataset.q, addDays(todayISO(), +b.dataset.n)); };
      body.onclick = e => {
        const ck = e.target.closest("[data-tk]"); if (ck) S.toggleTask(id, ck.dataset.tk);
        const rm = e.target.closest("[data-rmtk]"); if (rm) S.removeTask(id, rm.dataset.rmtk);
      };
    } else {
      const row = (k, v) => v || v === 0 ? `<div><dt>${k}</dt><dd>${v}</dd></div>` : "";
      body.innerHTML = `<dl class="kv">
        ${row(t("f.contato"), esc(l.contato))}${row(t("f.cargo"), esc(l.cargo))}
        ${row(t("f.telefone"), l.telefone ? `<span class="mono">${esc(l.telefone)}</span>` : "")}
        ${row(t("f.email"), l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : "")}
        ${row(t("f.cidade"), esc([l.cidade, regionName(l.pais, lang)].filter(Boolean).join(", ")))}
        ${row(t("f.endereco"), esc(l.endereco))}${row(t("f.segmento"), esc(l.segmento))}
        ${row(t("f.site"), l.site ? `<a href="${esc(/^https?:/.test(l.site) ? l.site : "https://" + l.site)}" target="_blank" rel="noopener">${esc(l.site.replace(/^https?:\/\//, ""))}</a>` : l.temSite === "nao" ? `<span class="badge warn">${t("prosp.noSite")}</span>` : "")}
        ${row("Instagram", l.instagram ? `<a href="https://instagram.com/${esc(l.instagram.replace(/^@/, ""))}" target="_blank" rel="noopener">${esc(l.instagram)}</a>` : "")}
        ${row(t("prosp.reviews"), l.avaliacoes != null ? `${l.nota != null ? `<span class="stars">★ ${esc(String(l.nota))}</span> · ` : ""}${l.avaliacoes}${l.mapsUrl ? ` · <a href="${esc(l.mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : ""}` : l.mapsUrl ? `<a href="${esc(l.mapsUrl)}" target="_blank" rel="noopener">Google Maps</a>` : "")}
        ${row(t("f.responsavel"), esc(l.responsavel))}${row(t("f.origem"), esc(originLabel(l.origem)))}
        ${row(t("f.tags"), (l.tags || []).map(x => `<span class="tag">${esc(x)}</span>`).join(" "))}
        ${row(t("lead.createdAt"), esc(fmtDateTime(l.criadoEm)))}${row(t("lead.updatedAt"), esc(relTime(l.atualizadoEm)))}
      </dl>${l.notas ? `<h3 class="h-sm">${t("f.notas")}</h3><p class="notes">${esc(l.notas)}</p>` : ""}`;
    }
    el.querySelector("[data-x]").onclick = close;
    $("#dr_stage", el).onchange = e => { S.setStage(id, e.target.value); toast(t("lead.movedTo") + " " + S.stage(e.target.value).nome); };
    el.querySelector(".tabs-in").onclick = e => { const b = e.target.closest("[data-tab]"); if (b) { cur = b.dataset.tab; d.rerender(); } };
    el.querySelector("[data-edit]").onclick = () => leadForm(S.getLead(id));
    el.querySelector("[data-compose]").onclick = e => { e.preventDefault(); close(); location.hash = "mensagens"; window.dispatchEvent(new CustomEvent("compose", { detail: id })); };
    el.querySelector("[data-del]").onclick = async () => { if (await confirmDialog(t("lead.confirmDelete"), { ok: t("common.delete"), danger: true })) { S.deleteLeads([id]); close(); toast(t("lead.deleted")); } };
    $$("[data-log]", el).forEach(a => a.addEventListener("click", () => setTimeout(() => S.addActivity(id, a.dataset.log, ""), 300)));
    body.addEventListener("click", e => { const b = e.target.closest("[data-rmact]"); if (b) S.removeActivity(id, b.dataset.rmact); });
  }, { onClose: () => unsub?.() });
  unsub = S.subscribe(() => { if (S.getLead(id)) { const ta = $("#act_txt"); const keep = ta?.value; d.rerender(); if (keep && $("#act_txt")) $("#act_txt").value = keep; } else d.close(); });
  return d;
}
function taskRow(k) {
  return `<li class="${k.feita ? "is-done" : ""}"><button class="ck" data-tk="${esc(k.id)}" aria-pressed="${!!k.feita}" aria-label="${t("task.toggle")}">${icon("check")}</button>
    <span class="tk-t">${esc(k.titulo)}</span>${k.feita ? "" : dueChip(k)}
    <button class="icon-btn xs" data-rmtk="${esc(k.id)}" aria-label="${t("common.delete")}">${icon("x")}</button></li>`;
}
