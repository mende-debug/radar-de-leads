import { $, esc, copyText, intlPhone, download } from "../util.js";
import { t, getLang } from "../i18n.js";
import * as S from "../store.js";
import { icon, toast } from "../ui.js";
import { parseCapture, openLead } from "../components.js";

let qrLoading = null;
const loadQR = () => qrLoading ||= new Promise((res, rej) => { if (window.qrcode) return res(window.qrcode); const s = document.createElement("script"); s.src = "js/vendor/qrcode.js"; s.onload = () => res(window.qrcode); s.onerror = rej; document.head.appendChild(s); });
// Desenha o QR num canvas (alta resolução, com margem branca) para exibir e baixar em PNG.
function drawQR(qrcode, text, px = 640) {
  const q = qrcode(0, "M"); q.addData(text, "Byte"); q.make();
  const n = q.getModuleCount(), m = 4, cell = Math.floor(px / (n + m * 2)), size = cell * (n + m * 2);
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, size, size); g.fillStyle = "#0E1726";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) g.fillRect((c + m) * cell, (r + m) * cell, cell, cell);
  return cv;
}

export function captureUrl(p, extra = {}) {
  const c = S.cfg(), u = new URL("captar.html", location.href);
  u.search = ""; u.hash = "";
  const q = { e: c.empresa, w: intlPhone(c.whatsapp, c.pais), l: getLang(), ...(p ? { p: p.nome, c: (p.cor || "").replace("#", "") } : {}), ...extra };
  for (const [k, v] of Object.entries(q)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

export default {
  title: () => t("nav.captacao"),
  mount(el) {
    const c = S.cfg();
    const ready = !!intlPhone(c.whatsapp, c.pais);
    el.innerHTML = `<div class="page-h"><div><h1>${t("nav.captacao")}</h1><p class="muted">${t("cap.lede")}</p></div></div>
      ${ready ? "" : `<div class="callout warn">${icon("whatsapp")}<div><b>${t("cap.needWa")}</b><p>${t("cap.needWaHint")}</p></div><a class="btn sm" href="#config">${t("nav.config")}</a></div>`}
      <div class="cap-grid">${[null, ...c.produtos].map((p, i) => `<article class="card cap" style="--c:${esc(p?.cor || "var(--accent)")}">
        <header class="card-h"><h2><i class="dot"></i>${esc(p ? p.nome : t("cap.general"))}</h2></header>
        <div class="qr" id="qr_${i}" aria-label="QR code"></div>
        <code class="url">${esc(captureUrl(p))}</code>
        <div class="row wrap center">
          <button class="btn sm" data-copy="${i}" ${ready ? "" : "disabled"}>${icon("copy")}${t("cap.copyLink")}</button>
          <a class="btn sm" href="${esc(captureUrl(p))}" target="_blank" rel="noopener">${icon("link")}${t("cap.open")}</a>
          <button class="btn sm" data-png="${i}" ${ready ? "" : "disabled"}>${icon("download")}QR</button>
        </div></article>`).join("")}</div>
      <section class="card stack" style="margin-top:16px">
        <header class="card-h"><h2>${icon("magnet")} ${t("cap.importTitle")}</h2></header>
        <p class="muted sm">${t("cap.importHint")}</p>
        <textarea id="cap_txt" rows="6" placeholder="${t("form.pasteHint")}"></textarea>
        <div class="row"><button class="btn primary" id="cap_go">${t("cap.importBtn")}</button></div>
      </section>
      <section class="card stack" style="margin-top:16px">
        <header class="card-h"><h2>${t("cap.howTitle")}</h2></header>
        <ol class="steps-ol"><li>${t("cap.how1")}</li><li>${t("cap.how2")}</li><li>${t("cap.how3")}</li><li>${t("cap.how4")}</li></ol>
      </section>`;
    const prods = [null, ...c.produtos];
    if (ready) loadQR().then(qr => prods.forEach((p, i) => { const box = $("#qr_" + i, el); if (!box) return; box.innerHTML = ""; const cv = drawQR(qr, captureUrl(p, { s: "qr" })); cv.style.width = cv.style.height = "160px"; box.appendChild(cv); }))
      .catch(() => prods.forEach((p, i) => { const b = $("#qr_" + i, el); if (b) b.textContent = t("cap.qrFail"); }));
    else prods.forEach((p, i) => { const b = $("#qr_" + i, el); if (b) b.innerHTML = `<span class="muted sm">${t("cap.needWa")}</span>`; });
    el.onclick = async e => {
      const cp = e.target.closest("[data-copy]"); if (cp) { toast((await copyText(captureUrl(prods[+cp.dataset.copy]))) ? t("common.copied") : t("common.copyFail")); return; }
      const png = e.target.closest("[data-png]");
      if (png) { const cv = $("#qr_" + png.dataset.png + " canvas", el); if (!cv) return; cv.toBlob(b => download(`qr-${(prods[+png.dataset.png]?.nome || "captacao").toLowerCase().replace(/\W+/g, "-")}.png`, b)); }
    };
    $("#cap_go", el).onclick = () => {
      const d = parseCapture($("#cap_txt", el).value);
      if (!d.contato && !d.empresa && !d.telefone) { toast(t("form.parseFail"), "warn"); return; }
      const l = S.createLead({ ...d, origem: "captacao", produtos: d.produtos || [], responsavel: c.usuario || "",
        tarefas: [{ id: "t" + Date.now().toString(36), titulo: t("task.firstContact"), vence: new Date().toISOString().slice(0, 10), feita: false }] });
      S.persist(); $("#cap_txt", el).value = ""; toast(t("lead.created")); openLead(l.id);
    };
  }
};
