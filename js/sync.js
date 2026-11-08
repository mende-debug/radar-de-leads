// Sincronização entre aparelhos usando um Gist secreto do GitHub.
import { state, persist, migrateLead, normalizeLead, defaultConfig, setPersistHook } from "./store.js";
import { lsGet, lsSet, nowISO } from "./util.js";
import { t } from "./i18n.js";

const API = "https://api.github.com", FILE = "radar-leads.json", DESC = "Radar de Leads - dados (não apagar)";
const K = { tok: "radar-leads-v1-gh-token", gist: "radar-leads-v1-gh-gist", last: "radar-leads-v1-gh-last" };

let timer = null, busy = false, again = false;
const listeners = new Set();
export const status = { state: "off", msg: "", last: lsGet(K.last, "") };
export const onStatus = fn => (listeners.add(fn), () => listeners.delete(fn));
function emit(s, msg = "") { status.state = s; status.msg = msg; status.last = lsGet(K.last, ""); listeners.forEach(f => f(status)); }

export const connected = () => !!lsGet(K.tok);

async function gh(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + lsGet(K.tok), "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}) } });
  if (r.status === 401) throw Object.assign(new Error(t("sync.err401")), { fatal: true });
  if (r.status === 403 || r.status === 404) throw Object.assign(new Error(t("sync.err403")), { status: r.status });
  if (!r.ok) throw new Error("GitHub " + r.status);
  return r.status === 204 ? null : r.json();
}
async function findGist() {
  const id = lsGet(K.gist); if (id) return id;
  for (let page = 1; page <= 5; page++) {
    const list = await gh("/gists?per_page=100&page=" + page);
    const g = list.find(g => g.description === DESC && g.files[FILE]);
    if (g) { lsSet(K.gist, g.id); return g.id; }
    if (list.length < 100) break;
  }
  const g = await gh("/gists", { method: "POST", body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: "{}" } } }) });
  lsSet(K.gist, g.id); return g.id;
}
async function readRemote(id) {
  const g = await gh("/gists/" + id);
  const f = g.files[FILE]; if (!f) return {};
  let txt = f.content; if (f.truncated) txt = await (await fetch(f.raw_url)).text();
  try { return JSON.parse(txt) || {}; } catch { return {}; }
}
export function merge(remote) {
  for (const [id, ts] of Object.entries(remote.removidos || {})) if (!state.removidos[id] || ts > state.removidos[id]) state.removidos[id] = ts;
  const byId = new Map(state.leads.map(l => [l.id, l]));
  for (const raw of remote.leads || []) {
    if (!raw || !raw.id) continue;
    const r = normalizeLead(migrateLead(raw)), l = byId.get(r.id);
    if (!l || (r.atualizadoEm || "") > (l.atualizadoEm || "")) byId.set(r.id, r);
  }
  const cutoff = new Date(Date.now() - 120 * 864e5).toISOString();
  for (const [id, ts] of Object.entries(state.removidos)) if (ts < cutoff) delete state.removidos[id];
  state.leads = [...byId.values()].filter(l => !(state.removidos[l.id] && state.removidos[l.id] >= (l.atualizadoEm || "")));
  if (remote.config && (remote.configAt || "") > (state.configAt || "")) { state.config = { ...defaultConfig(remote.config.idioma), ...remote.config }; state.configAt = remote.configAt; }
}
const snapshot = () => JSON.stringify({ app: "radar-crm", versao: 2, leads: state.leads, removidos: state.removidos, config: state.config, configAt: state.configAt });

export async function run() {
  if (!connected()) return emit("off");
  if (busy) { again = true; return; }
  busy = true; emit("busy");
  try {
    const id = await findGist();
    const remote = await readRemote(id);
    const before = snapshot();
    merge(remote);
    if (snapshot() !== before) persist(true);
    const content = snapshot();
    if (content !== JSON.stringify({ app: "radar-crm", versao: 2, leads: remote.leads || [], removidos: remote.removidos || {}, config: remote.config, configAt: remote.configAt }))
      await gh("/gists/" + id, { method: "PATCH", body: JSON.stringify({ files: { [FILE]: { content } } }) });
    lsSet(K.last, nowISO()); emit("ok");
  } catch (e) {
    if (e.status === 404) lsSet(K.gist, "");
    emit("error", e.message || t("sync.offline"));
  } finally {
    busy = false;
    if (again) { again = false; schedule(500); }
  }
}
export function schedule(ms = 1500) { if (!connected()) return; clearTimeout(timer); timer = setTimeout(run, ms); emit("pending"); }

export async function connect(token) {
  lsSet(K.tok, token.trim()); lsSet(K.gist, "");
  try { await gh("/gists?per_page=1"); }
  catch (e) { lsSet(K.tok, ""); emit("off"); throw e; }
  await run();
}
export function disconnect() { lsSet(K.tok, ""); lsSet(K.gist, ""); lsSet(K.last, ""); emit("off"); }

export function start() {
  setPersistHook(() => schedule());
  if (connected()) run(); else emit("off");
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") run(); });
  addEventListener("online", run);
  setInterval(() => { if (document.visibilityState === "visible" && !busy) run(); }, 60000);
}
