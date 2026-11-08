import { $, $$, esc, digits, normKey, splitList, lsGet, lsSet, isMobile, COUNTRIES, regionName } from "../util.js";
import { t, getLang } from "../i18n.js";
import * as S from "../store.js";
import { icon, toast } from "../ui.js";
import { productChips } from "../components.js";

const GKEY = "radar-leads-v1-gkey";
export const gKey = () => lsGet(GKEY, "");
export const setGKey = k => lsSet(GKEY, k);
const SEG = { pt: ["barbearia", "salão de beleza", "restaurante", "hamburgueria", "pizzaria", "clínica odontológica", "clínica de estética", "academia", "pet shop", "oficina mecânica", "imobiliária", "advogado", "padaria", "cafeteria", "loja de roupas", "hotel"],
  en: ["barber shop", "beauty salon", "restaurant", "burger", "pizza", "dentist", "aesthetic clinic", "gym", "pet shop", "auto repair", "real estate agency", "lawyer", "bakery", "coffee shop", "clothing store", "hotel"],
  es: ["barbería", "salón de belleza", "restaurante", "hamburguesería", "pizzería", "dentista", "clínica estética", "gimnasio", "tienda de mascotas", "taller mecánico", "inmobiliaria", "abogado", "panadería", "cafetería", "tienda de ropa", "hotel"] };
const OSM = [
  [/barb/, ['["shop"="hairdresser"]["name"~"barb",i]', '["shop"="barber"]']], [/salao|salon|beleza|belleza|beauty/, ['["shop"="hairdresser"]', '["shop"="beauty"]']],
  [/hamburg|burger/, ['["cuisine"~"burger"]']], [/pizz/, ['["cuisine"~"pizza"]']], [/restaur/, ['["amenity"="restaurant"]']],
  [/odonto|dent/, ['["amenity"="dentist"]', '["healthcare"="dentist"]']], [/estet|aesthet/, ['["shop"="beauty"]']], [/academ|gym|gimnas/, ['["leisure"="fitness_centre"]']],
  [/pet|mascot/, ['["shop"="pet"]', '["amenity"="veterinary"]']], [/oficina|repair|taller/, ['["shop"="car_repair"]']], [/imobil|real estate|inmobil/, ['["office"="estate_agent"]']],
  [/advog|lawyer|abogad/, ['["office"="lawyer"]']], [/padar|baker|panad/, ['["shop"="bakery"]']], [/cafe/, ['["amenity"="cafe"]']], [/roupa|cloth|ropa/, ['["shop"="clothes"]']], [/hotel/, ['["tourism"="hotel"]']]
];
const IN = { pt: "em", en: "in", es: "en" };

let results = [], selected = new Set(), searching = null;
const pref = JSON.parse(lsGet("radar-crm-prosp", "{}") || "{}");
const P = { src: "google", segs: "", cities: "", country: "", semSite: false, tel: true, novo: true, max: "", ...pref };
const savePref = () => lsSet("radar-crm-prosp", JSON.stringify(P));

function inFunnel(r) {
  const tel = digits(r.telefone).slice(-8), nm = normKey(r.nome);
  return S.state.leads.some(l => (r.placeId && l.placeId === r.placeId) || (tel.length === 8 && digits(l.telefone).slice(-8) === tel) || (nm && normKey(l.empresa) === nm && normKey(l.cidade) === normKey(r.cidade)));
}
function rank(r) { let s = 0; if (!r.site) s += 2; if (r.avaliacoes != null && r.avaliacoes < 80) s += 2 - r.avaliacoes / 80; if (r.telefone && isMobile(r.telefone, r.pais)) s += 1; if (r.telefone) s += 0.5; return s; }

async function google(q, token, signal, country) {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", { method: "POST", signal,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": gKey(), "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,places.primaryTypeDisplayName,nextPageToken" },
    body: JSON.stringify({ textQuery: q, languageCode: getLang() === "pt" ? "pt-BR" : getLang(), regionCode: country, pageSize: 20, ...(token ? { pageToken: token } : {}) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = j.error?.message || "Google " + r.status;
    throw Object.assign(new Error(/API key not valid/i.test(m) ? t("prosp.errKey") : /referer|referrer/i.test(m) ? t("prosp.errReferer") : /not been used|disabled|SERVICE_DISABLED/i.test(m) ? t("prosp.errApi") : /billing/i.test(m) ? t("prosp.errBilling") : m), { fatal: true });
  }
  return j;
}
async function runGoogle(seg, city, country, signal, onPage) {
  let token = null, page = 0;
  do {
    const j = await google(`${seg} ${IN[getLang()]} ${city}`, token, signal, country); page++;
    onPage((j.places || []).filter(p => p.businessStatus !== "CLOSED_PERMANENTLY").map(p => ({
      placeId: p.id, nome: p.displayName?.text || "", endereco: p.formattedAddress || "", telefone: p.internationalPhoneNumber || p.nationalPhoneNumber || "",
      site: p.websiteUri || "", nota: p.rating ?? null, avaliacoes: p.userRatingCount ?? 0, mapsUrl: p.googleMapsUri || "", tipo: p.primaryTypeDisplayName?.text || "",
      segmento: seg, cidade: city, pais: country, fonte: "Google Maps" })), page);
    token = j.nextPageToken;
    if (token) await new Promise(r => setTimeout(r, 1200));
  } while (token && page < 3 && !signal.aborted);
}
async function runOsm(seg, city, country, signal, onPage) {
  const g = await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=${country.toLowerCase()}&q=${encodeURIComponent(city)}`, { signal })).json();
  if (!g.length) throw new Error(t("prosp.errCity").replace("{c}", city));
  const [s, n, w, e] = g[0].boundingbox.map(Number), bbox = `(${s},${w},${n},${e})`;
  const k = normKey(seg), hit = OSM.find(([re]) => re.test(k));
  const sels = hit ? hit[1] : [`["name"~"${seg.replace(/["\\]/g, "")}",i]`];
  const q = `[out:json][timeout:25];(${sels.map(x => `nwr${x}${bbox};`).join("")});out center tags 300;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", signal, body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  if (!r.ok) throw new Error(t("prosp.errOsm"));
  const j = await r.json();
  onPage((j.elements || []).filter(x => x.tags?.name).map(x => { const tg = x.tags, lat = x.lat ?? x.center?.lat, lon = x.lon ?? x.center?.lon;
    return { placeId: "osm:" + x.type + "/" + x.id, nome: tg.name, endereco: [tg["addr:street"], tg["addr:housenumber"], tg["addr:suburb"]].filter(Boolean).join(", ") || city,
      telefone: tg.phone || tg["contact:phone"] || tg["contact:whatsapp"] || tg.mobile || "", site: tg.website || tg["contact:website"] || "", email: tg.email || tg["contact:email"] || "",
      instagram: tg["contact:instagram"] || "", nota: null, avaliacoes: null, mapsUrl: lat ? `https://www.google.com/maps/search/${encodeURIComponent(tg.name)}/@${lat},${lon},18z` : "",
      tipo: "", segmento: seg, cidade: city, pais: country, fonte: "OpenStreetMap" }; }), 1);
}

function visible() {
  return results.map(r => ({ ...r, dup: inFunnel(r) })).filter(r => (!P.semSite || !r.site) && (!P.tel || r.telefone) && (!P.novo || !r.dup) && (P.max === "" || r.avaliacoes == null || r.avaliacoes <= +P.max))
    .sort((a, b) => rank(b) - rank(a));
}

export default {
  title: () => t("nav.prospectar"),
  mount(el) {
    const lang = getLang(), country = P.country || S.cfg().pais;
    el.innerHTML = `
      <div class="page-h"><div><h1>${t("nav.prospectar")}</h1><p class="muted">${t("prosp.lede")}</p></div></div>
      <section class="card stack">
        <div class="fgrid">
          <label class="field">${t("prosp.segments")}<input id="ps_seg" value="${esc(P.segs)}" placeholder="${esc(SEG[lang].slice(0, 2).join(", "))}"></label>
          <label class="field">${t("prosp.cities")}<input id="ps_city" value="${esc(P.cities)}" placeholder="${t("prosp.citiesPh")}"></label>
          <label class="field">${t("f.pais")}<select id="ps_country">${COUNTRIES.map(k => `<option value="${k}" ${k === country ? "selected" : ""}>${esc(regionName(k, lang))}</option>`).join("")}</select></label>
        </div>
        <div class="ideas" id="ps_ideas">${SEG[lang].map(s => `<button type="button" class="chip-btn">${esc(s)}</button>`).join("")}</div>
        <div class="row wrap gap-lg">
          <div class="seg" id="ps_src" role="group" aria-label="${t("prosp.source")}">
            <button data-s="google" aria-pressed="${P.src === "google"}">${icon("map")}Google Maps</button>
            <button data-s="osm" aria-pressed="${P.src === "osm"}">${icon("globe")}OpenStreetMap <small>${t("prosp.free")}</small></button></div>
          <label class="check"><input type="checkbox" id="ps_semSite" ${P.semSite ? "checked" : ""}> ${t("prosp.onlyNoSite")}</label>
          <label class="check"><input type="checkbox" id="ps_tel" ${P.tel ? "checked" : ""}> ${t("prosp.onlyPhone")}</label>
          <label class="check"><input type="checkbox" id="ps_novo" ${P.novo ? "checked" : ""}> ${t("prosp.hideDup")}</label>
          <label class="check">${t("prosp.upTo")} <input id="ps_max" type="number" min="0" inputmode="numeric" value="${esc(P.max)}" placeholder="∞" class="in-xs"> ${t("prosp.reviewsWord")}</label>
        </div>
        <div class="row"><button class="btn primary" id="ps_go">${icon("radar")}${t("prosp.search")}</button><button class="btn" id="ps_stop" hidden>${t("prosp.stop")}</button><span id="ps_prog" class="muted sm" role="status"></span></div>
        <details class="keybox" id="ps_key" ${P.src === "google" && !gKey() ? "open" : ""}><summary>${t("prosp.keyTitle")} <span class="badge ${gKey() ? "ok" : ""}" id="ps_keyb">${gKey() ? t("prosp.keyOk") : t("prosp.keyMissing")}</span></summary>
          <div class="stack-sm">
            <p class="muted sm">${t("prosp.keyIntro")}</p>
            <ol class="steps-ol">
              <li>${t("prosp.k1").replace("{a}", '<a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener">Google Cloud</a>')}</li>
              <li>${t("prosp.k2").replace("{a}", '<a href="https://console.cloud.google.com/apis/library/places.googleapis.com" target="_blank" rel="noopener">Places API (New)</a>')}</li>
              <li>${t("prosp.k3").replace("{a}", '<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">' + t("prosp.credentials") + "</a>")}</li>
              <li>${t("prosp.k4").replace("{h}", `<code>${esc(location.host || "mende-debug.github.io")}/*</code>`)}</li>
            </ol>
            <div class="row"><input id="ps_gkey" type="password" autocomplete="off" placeholder="AIza…" aria-label="Google API key" class="grow"><button class="btn" id="ps_gsave">${t("common.save")}</button><button class="btn ghost" id="ps_gdel" ${gKey() ? "" : "hidden"}>${t("common.remove")}</button></div>
          </div></details>
      </section>
      <section class="card" id="ps_res" ${results.length ? "" : "hidden"}>
        <header class="card-h wrap"><div><h2 id="ps_title"></h2><span class="muted sm" id="ps_sub"></span></div>
          <div class="row"><button class="btn sm" id="ps_all"></button><button class="btn sm primary" id="ps_add" disabled></button></div></header>
        <ul class="res-list" id="ps_list"></ul></section>`;
    const save = () => { P.segs = $("#ps_seg", el).value; P.cities = $("#ps_city", el).value; P.country = $("#ps_country", el).value; P.semSite = $("#ps_semSite", el).checked; P.tel = $("#ps_tel", el).checked; P.novo = $("#ps_novo", el).checked; P.max = $("#ps_max", el).value; savePref(); };
    const markIdeas = () => { const cur = splitList($("#ps_seg", el).value).map(x => x.toLowerCase()); $$("#ps_ideas button", el).forEach(b => b.setAttribute("aria-pressed", cur.includes(b.textContent.toLowerCase()))); };
    markIdeas();
    $("#ps_ideas", el).onclick = e => { const b = e.target.closest("button"); if (!b) return; const cur = splitList($("#ps_seg", el).value), i = cur.map(x => x.toLowerCase()).indexOf(b.textContent.toLowerCase()); i >= 0 ? cur.splice(i, 1) : cur.push(b.textContent); $("#ps_seg", el).value = cur.join(", "); markIdeas(); save(); };
    ["#ps_seg", "#ps_city", "#ps_country"].forEach(s => $(s, el).addEventListener("input", () => { save(); markIdeas(); }));
    ["#ps_semSite", "#ps_tel", "#ps_novo", "#ps_max"].forEach(s => $(s, el).addEventListener("input", () => { save(); this.refresh(el); }));
    $("#ps_src", el).onclick = e => { const b = e.target.closest("button"); if (!b) return; P.src = b.dataset.s; savePref(); $$("#ps_src button", el).forEach(x => x.setAttribute("aria-pressed", x === b)); };
    $("#ps_gsave", el).onclick = () => { const k = $("#ps_gkey", el).value.trim(); if (!k) return; setGKey(k); $("#ps_gkey", el).value = ""; toast(t("prosp.keySaved")); this.mount(el); };
    $("#ps_gdel", el).onclick = () => { setGKey(""); this.mount(el); };
    $("#ps_go", el).onclick = () => this.search(el);
    $("#ps_stop", el).onclick = () => searching?.abort();
    $("#ps_list", el).addEventListener("change", e => { const k = e.target.dataset?.k; if (!k) return; e.target.checked ? selected.add(k) : selected.delete(k); this.refresh(el); });
    $("#ps_all", el).onclick = () => { const V = visible().filter(r => !r.dup); V.every(r => selected.has(r.placeId)) ? selected.clear() : V.forEach(r => selected.add(r.placeId)); this.refresh(el); };
    $("#ps_add", el).onclick = () => this.add(el);
    this.refresh(el);
  },
  async search(el) {
    const segs = splitList(P.segs), cities = splitList(P.cities), country = P.country || S.cfg().pais;
    if (!segs.length || !cities.length) { toast(t("prosp.needBoth"), "warn"); return; }
    if (P.src === "google" && !gKey()) { $("#ps_key", el).open = true; $("#ps_gkey", el).focus(); toast(t("prosp.needKey"), "warn"); return; }
    const combos = segs.flatMap(s => cities.map(c => [s, c])).slice(0, 30);
    results = []; selected.clear(); $("#ps_res", el).hidden = false;
    const ctl = new AbortController(); searching = ctl;
    $("#ps_go", el).disabled = true; $("#ps_stop", el).hidden = false;
    const seen = new Set(), errs = [], prog = $("#ps_prog", el); prog.classList.remove("err");
    this.refresh(el);
    for (const [i, [seg, city]] of combos.entries()) {
      if (ctl.signal.aborted) break;
      prog.textContent = t("prosp.searching").replace("{s}", seg).replace("{c}", city) + (combos.length > 1 ? ` (${i + 1}/${combos.length})` : "");
      try {
        await (P.src === "google" ? runGoogle : runOsm)(seg, city, country, ctl.signal, items => {
          for (const it of items) { const k = it.placeId || normKey(it.nome) + digits(it.telefone); if (seen.has(k)) continue; seen.add(k); results.push(it); }
          this.refresh(el);
        });
      } catch (e) { if (e.name === "AbortError") break; errs.push(e.message); if (e.fatal) break; }
    }
    searching = null; $("#ps_go", el).disabled = false; $("#ps_stop", el).hidden = true;
    prog.textContent = errs.length ? errs[0] : ctl.signal.aborted ? t("prosp.stopped") : t("prosp.done").replace("{n}", results.length);
    prog.classList.toggle("err", !!errs.length);
    this.refresh(el);
  },
  add(el) {
    const V = visible().filter(r => selected.has(r.placeId) && !r.dup);
    if (!V.length) return;
    const first = S.openStages()[0]?.id;
    S.addLeads(V.map(r => {
      const produtos = S.fitFor({ avaliacoes: r.avaliacoes, temSite: r.site ? "sim" : "nao" });
      return { empresa: r.nome, telefone: r.telefone, email: r.email || "", instagram: r.instagram || "", segmento: r.segmento, cidade: r.cidade, pais: r.pais, endereco: r.endereco,
        site: r.site, temSite: r.site ? "sim" : "nao", avaliacoes: r.avaliacoes, nota: r.nota, mapsUrl: r.mapsUrl, placeId: r.placeId, produtos, etapa: first,
        origem: "prospeccao", responsavel: S.cfg().usuario || "", tags: [r.fonte === "Google Maps" ? "google-maps" : "osm"],
        tarefas: [{ id: "t" + Math.random().toString(36).slice(2, 9), titulo: t("task.firstContact"), vence: new Date().toISOString().slice(0, 10), feita: false }] };
    }));
    selected.clear(); this.refresh(el);
    toast(t("prosp.added").replace("{n}", V.length));
  },
  refresh(el) {
    const res = $("#ps_res", el); if (!res) return;
    const V = visible(), keys = new Set(V.map(r => r.placeId));
    for (const k of [...selected]) if (!keys.has(k)) selected.delete(k);
    $("#ps_title", el).textContent = t("prosp.found").replace("{n}", V.length);
    $("#ps_sub", el).textContent = results.length > V.length ? t("prosp.hidden").replace("{n}", results.length - V.length) : t("prosp.bestFirst");
    const add = $("#ps_add", el); add.disabled = !selected.size; add.textContent = selected.size ? t("prosp.addN").replace("{n}", selected.size) : t("prosp.add");
    $("#ps_all", el).textContent = V.length && V.filter(r => !r.dup).every(r => selected.has(r.placeId)) ? t("bulk.clear") : t("bulk.selectAll");
    $("#ps_list", el).innerHTML = V.map(r => {
      const fit = S.fitFor({ avaliacoes: r.avaliacoes, temSite: r.site ? "sim" : "nao" });
      return `<li class="res ${r.dup ? "dup" : ""}"><label class="res-l">
        <input type="checkbox" data-k="${esc(r.placeId)}" ${selected.has(r.placeId) ? "checked" : ""} ${r.dup ? "disabled" : ""} aria-label="${esc(r.nome)}">
        <span class="res-b"><b>${esc(r.nome)}</b>
          <span class="res-m">${r.nota != null ? `<span class="stars">★ ${esc(String(r.nota))}</span>` : ""}
            ${r.avaliacoes != null ? `<span><b class="mono">${r.avaliacoes}</b> ${t("prosp.reviewsWord")}</span>` : ""}
            ${r.telefone ? `<span class="mono">${esc(r.telefone)}</span>${isMobile(r.telefone, r.pais) ? `<span class="badge ok">${icon("whatsapp")}WhatsApp</span>` : ""}` : `<span class="muted">${t("prosp.noPhone")}</span>`}
            ${r.site ? `<a href="${esc(r.site)}" target="_blank" rel="noopener">${t("prosp.hasSite")}</a>` : `<span class="badge warn">${t("prosp.noSite")}</span>`}
            ${r.dup ? `<span class="badge">${t("prosp.inFunnel")}</span>` : productChips(fit)}</span>
          <span class="res-a muted">${esc(r.endereco)}${r.tipo ? " · " + esc(r.tipo) : ""}</span></span></label>
        ${r.mapsUrl ? `<a class="btn sm ghost" href="${esc(r.mapsUrl)}" target="_blank" rel="noopener">${icon("map")}Maps</a>` : ""}</li>`;
    }).join("") || `<li class="empty">${searching ? t("prosp.searchingShort") : results.length ? t("prosp.noneFilter") : t("prosp.none")}</li>`;
  }
};
