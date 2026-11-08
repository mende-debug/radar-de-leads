import { $, $$, esc, norm } from "../util.js";
import { t } from "../i18n.js";
import * as S from "../store.js";
import { icon, toast } from "../ui.js";
import { money, avatar, scoreBadge, productChips, dueChip, openLead } from "../components.js";

let filter = { q: "", prod: "", owner: "", hideClosed: false };

export default {
  title: () => t("nav.pipeline"),
  mount(el) {
    const c = S.cfg();
    const owners = [...new Set(S.state.leads.map(l => l.responsavel).filter(Boolean))];
    el.innerHTML = `
      <div class="page-h"><div><h1>${t("nav.pipeline")}</h1><p class="muted" id="pl_sum"></p></div>
        <div class="row"><button class="btn primary" data-action="new-lead">${icon("plus")}${t("lead.new")}</button></div></div>
      <div class="toolbar">
        <label class="search-in">${icon("search")}<input id="pl_q" type="search" placeholder="${t("leads.search")}" value="${esc(filter.q)}" aria-label="${t("leads.search")}"></label>
        <select id="pl_prod" aria-label="${t("f.produtos")}"><option value="">${t("leads.allProducts")}</option>${c.produtos.map(p => `<option value="${esc(p.id)}" ${filter.prod === p.id ? "selected" : ""}>${esc(p.nome)}</option>`).join("")}</select>
        ${owners.length ? `<select id="pl_owner" aria-label="${t("f.responsavel")}"><option value="">${t("leads.allOwners")}</option>${owners.map(o => `<option ${filter.owner === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>` : ""}
        <label class="check"><input type="checkbox" id="pl_closed" ${filter.hideClosed ? "checked" : ""}> ${t("pipe.hideClosed")}</label>
      </div>
      <div class="board" id="board" role="list"></div>`;
    const upd = () => { filter.q = $("#pl_q", el).value; filter.prod = $("#pl_prod", el).value; filter.owner = $("#pl_owner", el)?.value || ""; filter.hideClosed = $("#pl_closed", el).checked; this.refresh(el); };
    ["#pl_q", "#pl_prod", "#pl_owner", "#pl_closed"].forEach(s => $(s, el)?.addEventListener("input", upd));
    const board = $("#board", el);
    board.addEventListener("click", e => {
      const adv = e.target.closest("[data-adv]");
      if (adv) { e.stopPropagation(); S.setStage(adv.dataset.adv, adv.dataset.to); toast(t("lead.movedTo") + " " + S.stage(adv.dataset.to).nome); return; }
      const card = e.target.closest("[data-id]"); if (card && !card.dataset.dragged) openLead(card.dataset.id);
    });
    board.addEventListener("keydown", e => {
      const card = e.target.closest("[data-id]"); if (!card) return;
      if (e.key === "Enter") openLead(card.dataset.id);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const l = S.getLead(card.dataset.id), et = S.cfg().etapas, i = et.findIndex(s => s.id === l.etapa) + (e.key === "ArrowRight" ? 1 : -1);
        if (et[i]) { S.setStage(l.id, et[i].id); requestAnimationFrame(() => $(`[data-id="${l.id}"]`, el)?.focus()); }
      }
    });
    dragAndDrop(board);
    this.refresh(el);
  },
  refresh(el) {
    const c = S.cfg(), q = norm(filter.q);
    const L = S.state.leads.filter(l => (!filter.prod || l.produtos.includes(filter.prod)) && (!filter.owner || l.responsavel === filter.owner) &&
      (!q || norm([l.empresa, l.contato, l.cidade, l.segmento, (l.tags || []).join(" ")].join(" ")).includes(q)));
    const stages = c.etapas.filter(s => !(filter.hideClosed && s.tipo));
    const open = L.filter(S.isOpen);
    $("#pl_sum", el).textContent = `${open.length} ${t("dash.open")} · ${money(open.reduce((s, l) => s + (+l.valor || 0), 0))}`;
    const board = $("#board", el), scroll = board.scrollLeft;
    board.innerHTML = stages.map((s, si) => {
      const ls = L.filter(l => l.etapa === s.id).sort((a, b) => S.score(b) - S.score(a));
      const next = c.etapas[c.etapas.indexOf(s) + 1];
      return `<section class="col" data-stage="${esc(s.id)}" role="listitem" aria-label="${esc(s.nome)}">
        <header class="col-h" style="--c:${esc(s.cor)}"><span class="col-t"><i class="dot"></i>${esc(s.nome)} <span class="count">${ls.length}</span></span>
          <span class="col-v">${money(ls.reduce((a, l) => a + (+l.valor || 0), 0))}${s.tipo ? "" : ` · ${s.prob}%`}</span></header>
        <div class="col-b">${ls.map(l => {
          const nt = S.nextTask(l);
          return `<article class="kcard" data-id="${esc(l.id)}" tabindex="0" aria-label="${esc(S.leadName(l))}">
            <div class="kc-top">${avatar(l, "sm")}<div class="kc-n"><b>${esc(S.leadName(l))}</b><span>${esc([l.contato && l.empresa ? l.contato : "", l.cidade].filter(Boolean).join(" · "))}</span></div>${scoreBadge(l)}</div>
            <div class="kc-mid">${productChips(l.produtos)}</div>
            <div class="kc-bot"><b class="mono">${money(l.valor)}</b>${dueChip(nt)}
              ${next && !s.tipo ? `<button class="adv" data-adv="${esc(l.id)}" data-to="${esc(next.id)}" title="${t("pipe.moveTo")} ${esc(next.nome)}" aria-label="${t("pipe.moveTo")} ${esc(next.nome)}">${icon("chevron")}</button>` : ""}</div>
          </article>`;
        }).join("") || `<p class="col-empty">${si === 0 ? t("pipe.emptyFirst") : t("pipe.empty")}</p>`}</div></section>`;
    }).join("");
    board.scrollLeft = scroll;
  }
};

// Arrastar e soltar com mouse/caneta; no toque, pressionar e segurar por 300 ms.
let drag = null, holdTimer = null, board = null, installed = false;
function dragAndDrop(b) {
  board = b;
  const cleanup = () => {
    clearTimeout(holdTimer);
    if (!drag) return;
    drag.ghost?.remove(); drag.card.classList.remove("dragging");
    $$(".col.over", board).forEach(c => c.classList.remove("over"));
    document.body.classList.remove("is-dragging");
    const card = drag.card; setTimeout(() => delete card.dataset.dragged, 0);
    drag = null;
  };
  const begin = (card, e) => {
    const r = card.getBoundingClientRect();
    const ghost = card.cloneNode(true); ghost.classList.add("ghost"); ghost.style.width = r.width + "px";
    document.body.appendChild(ghost);
    drag = { card, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, started: true };
    card.classList.add("dragging"); card.dataset.dragged = "1"; document.body.classList.add("is-dragging");
    move(e);
  };
  const move = e => {
    if (!drag?.started) return;
    drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px) rotate(1.5deg)`;
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest(".col");
    $$(".col.over", board).forEach(c => c !== col && c.classList.remove("over"));
    col?.classList.add("over");
    const br = board.getBoundingClientRect();
    if (e.clientX > br.right - 50) board.scrollLeft += 12; else if (e.clientX < br.left + 50) board.scrollLeft -= 12;
  };
  board.addEventListener("pointerdown", e => {
    const card = e.target.closest(".kcard"); if (!card || e.target.closest("button") || e.button > 0) return;
    const sx = e.clientX, sy = e.clientY;
    if (e.pointerType === "touch") {
      holdTimer = setTimeout(() => { navigator.vibrate?.(15); begin(card, { clientX: sx, clientY: sy }); }, 300);
      const cancel = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8 && !drag) { clearTimeout(holdTimer); board.removeEventListener("pointermove", cancel); } };
      board.addEventListener("pointermove", cancel);
    } else {
      const onMove = ev => { if (!drag && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) begin(card, ev); };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", () => window.removeEventListener("pointermove", onMove), { once: true });
    }
  });
  board.addEventListener("touchmove", e => { if (drag) e.preventDefault(); }, { passive: false });
  if (installed) return;
  installed = true;
  window.addEventListener("pointermove", e => { if (drag) { e.preventDefault(); move(e); } }, { passive: false });
  window.addEventListener("pointerup", e => {
    clearTimeout(holdTimer);
    if (!drag) return;
    const col = document.elementFromPoint(e.clientX, e.clientY)?.closest(".col");
    const id = drag.card.dataset.id;
    cleanup();
    if (col && S.getLead(id)?.etapa !== col.dataset.stage) { S.setStage(id, col.dataset.stage); toast(t("lead.movedTo") + " " + S.stage(col.dataset.stage).nome); }
  });
  window.addEventListener("pointercancel", cleanup);
}
