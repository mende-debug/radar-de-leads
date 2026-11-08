// Utilitários puros: DOM, formatação, telefone, CSV.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = (p = "") => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const nowISO = () => new Date().toISOString();
export const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const addDays = (iso, n) => { const d = new Date((iso || todayISO()) + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const digits = s => String(s ?? "").replace(/\D/g, "");
export const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const normKey = s => norm(s).replace(/[^a-z0-9]/g, "");
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const splitList = s => String(s ?? "").split(/[,;\n]/).map(x => x.trim()).filter(Boolean);

let LOCALE = "pt-BR";
export const setLocale = l => { LOCALE = l; };
export const getLocale = () => LOCALE;

export function fmtMoney(v, cur = "BRL", compact = false) {
  const n = +v || 0;
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency: cur, maximumFractionDigits: compact || n >= 1000 ? 0 : 2, notation: compact && Math.abs(n) >= 10000 ? "compact" : "standard" }).format(n);
  } catch { return cur + " " + n.toFixed(0); }
}
export const fmtNum = v => new Intl.NumberFormat(LOCALE).format(+v || 0);
export const fmtPct = v => new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 0 }).format(+v || 0);
export function fmtDate(iso, opts = { day: "2-digit", month: "short" }) {
  if (!iso) return "";
  const d = iso.length <= 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  return isNaN(d) ? "" : d.toLocaleDateString(LOCALE, opts);
}
export function fmtDateTime(iso) {
  const d = new Date(iso); if (isNaN(d)) return "";
  return d.toLocaleString(LOCALE, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function relTime(iso) {
  if (!iso) return "";
  const d = iso.length <= 10 ? new Date(iso + "T12:00:00") : new Date(iso);
  const diff = (d - Date.now()) / 1000, a = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  if (iso.length <= 10) return rtf.format(Math.round((new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 864e5), "day");
  if (a < 60) return rtf.format(Math.round(diff), "second");
  if (a < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (a < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return fmtDate(iso);
}
export function regionName(code, lang) {
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(code) || code; } catch { return code; }
}

// Códigos de discagem (WhatsApp) por país.
export const DIAL = {
  BR: "55", PT: "351", US: "1", CA: "1", MX: "52", AR: "54", CL: "56", CO: "57", PE: "51", UY: "598", PY: "595", BO: "591",
  EC: "593", VE: "58", CR: "506", PA: "507", DO: "1", GT: "502", ES: "34", FR: "33", DE: "49", IT: "39", GB: "44", IE: "353",
  NL: "31", BE: "32", CH: "41", AT: "43", SE: "46", NO: "47", DK: "45", FI: "358", PL: "48", AO: "244", MZ: "258", CV: "238",
  ZA: "27", NG: "234", KE: "254", MA: "212", EG: "20", AE: "971", SA: "966", IL: "972", TR: "90", IN: "91", JP: "81",
  CN: "86", KR: "82", SG: "65", ID: "62", PH: "63", TH: "66", VN: "84", AU: "61", NZ: "64"
};
export const COUNTRIES = Object.keys(DIAL);
export const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "MXN", "ARS", "CLP", "COP", "PEN", "UYU", "CAD", "AUD", "CHF", "JPY", "INR", "AOA", "MZN", "ZAR", "AED"];

// Número internacional só com dígitos, pronto para wa.me.
export function intlPhone(raw, country = "BR") {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.startsWith("+")) return digits(s);
  let d = digits(s);
  if (d.startsWith("00")) return d.slice(2);
  const dial = DIAL[country] || "";
  if (country === "BR") {
    if (d.startsWith("55") && d.length >= 12) return d;
    d = d.replace(/^0+/, "");
    return d.length >= 10 ? "55" + d : d;
  }
  if (dial && d.startsWith(dial) && d.length > 9) return d;
  return dial + d.replace(/^0+/, "");
}
export function isMobile(raw, country = "BR") {
  const d = intlPhone(raw, country);
  if (d.startsWith("55")) return d.length === 13 && d[4] === "9";
  return d.length >= 10;
}
export const waUrl = (phone, country, text = "") => "https://wa.me/" + intlPhone(phone, country) + (text ? "?text=" + encodeURIComponent(text) : "");

// CSV (RFC 4180) — leitura e escrita.
export function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  const sep = (text.split("\n")[0].match(/;/g) || []).length > (text.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
export function toCSV(rows) {
  return rows.map(r => r.map(v => { const s = String(v ?? ""); return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\r\n");
}

export function download(filename, content, type = "text/plain") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {}
    ta.remove(); return ok;
  }
}

export const lsGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
export const lsSet = (k, v) => { try { v == null || v === "" ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
