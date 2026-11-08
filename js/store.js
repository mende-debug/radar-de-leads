// Estado do CRM: leads, configuração, persistência local, migração e regras de negócio.
import { uid, nowISO, todayISO, addDays, lsGet, lsSet, isMobile, clamp } from "./util.js";
import { t, defaultTemplates, getLang } from "./i18n.js";

const KEY = "radar-crm-v2";
const OLD = "radar-leads-v1";

export const state = { leads: [], removidos: {}, config: null, configAt: "" };
const subs = new Set();
export const subscribe = fn => (subs.add(fn), () => subs.delete(fn));
let onPersist = () => {};
export const setPersistHook = fn => { onPersist = fn; };

export function defaultConfig(lang = getLang()) {
  return {
    empresa: "Radar", usuario: "", idioma: lang, moeda: lang === "pt" ? "BRL" : lang === "es" ? "EUR" : "USD",
    pais: lang === "pt" ? "BR" : lang === "es" ? "ES" : "US", whatsapp: "", metaMensal: 0,
    etapas: [
      { id: "novo", nome: t("st.novo"), prob: 10, cor: "#7C8799" },
      { id: "contatado", nome: t("st.contatado"), prob: 20, cor: "#4C6EF5" },
      { id: "qualificado", nome: t("st.qualificado"), prob: 40, cor: "#7950F2" },
      { id: "proposta", nome: t("st.proposta"), prob: 60, cor: "#E8590C" },
      { id: "negociacao", nome: t("st.negociacao"), prob: 80, cor: "#D6336C" },
      { id: "ganho", nome: t("st.ganho"), prob: 100, cor: "#2F9E44", tipo: "ganho" },
      { id: "perdido", nome: t("st.perdido"), prob: 0, cor: "#868E96", tipo: "perdido" }
    ],
    produtos: [
      { id: "nfc", nome: t("prod.nfc"), preco: 150, cor: "#6741D9", tipo: "nfc" },
      { id: "sites", nome: t("prod.sites"), preco: 1500, cor: "#0C8599", tipo: "site" }
    ],
    equipe: [],
    origens: ["prospeccao", "captacao", "indicacao", "instagram", "whatsapp", "evento", "outro"],
    templates: defaultTemplates(lang)
  };
}

/* ---------- Migração do formato antigo (v1) ---------- */
const OLD_STAGE = { novo: "novo", contatado: "contatado", interessado: "qualificado", proposta: "proposta", fechado: "ganho", perdido: "perdido" };
export function migrateLead(o) {
  if (!o || o.empresa !== undefined || o.etapa !== undefined) return o;
  const produtos = o.projeto === "ambos" ? ["nfc", "sites"] : o.projeto === "sites" ? ["sites"] : ["nfc"];
  const l = {
    id: o.id, empresa: o.negocio || o.nome || "", contato: o.negocio ? (o.nome || "") : "", telefone: o.telefone || "",
    email: "", instagram: o.instagram || "", segmento: o.segmento || "", cidade: o.cidade || "", pais: "BR",
    endereco: o.endereco || "", site: o.site || "", temSite: o.temSite || "", avaliacoes: o.avaliacoes === "" || o.avaliacoes == null ? null : +o.avaliacoes,
    nota: o.nota === "" || o.nota == null ? null : +o.nota, mapsUrl: o.mapsUrl || "", placeId: o.placeId || "",
    produtos, etapa: OLD_STAGE[o.status] || "novo", valor: +o.valor || 0, responsavel: "", tags: o.exemplo ? ["exemplo"] : [],
    origem: /autom/i.test(o.origem || "") || /prosp/i.test(o.origem || "") ? "prospeccao" : /indic/i.test(o.origem || "") ? "indicacao" : /insta/i.test(o.origem || "") ? "instagram" : /whats/i.test(o.origem || "") ? "whatsapp" : "outro",
    notas: o.notas || "", atividades: [], tarefas: [],
    criadoEm: o.criadoEm || o.atualizadoEm || nowISO(), atualizadoEm: o.atualizadoEm || nowISO()
  };
  if (o.proximo && !["fechado", "perdido"].includes(o.status)) l.tarefas.push({ id: uid("t"), titulo: t("task.followup"), vence: o.proximo, feita: false });
  if (l.etapa === "ganho") l.ganhoEm = l.atualizadoEm;
  l.atividades.push({ id: uid("a"), tipo: "criado", texto: "", em: l.criadoEm });
  return l;
}

export function normalizeLead(l) {
  return {
    empresa: "", contato: "", cargo: "", telefone: "", email: "", instagram: "", segmento: "", cidade: "", pais: state.config?.pais || "BR",
    endereco: "", site: "", temSite: "", avaliacoes: null, nota: null, mapsUrl: "", placeId: "", produtos: [], etapa: state.config?.etapas[0]?.id || "novo",
    valor: 0, responsavel: "", tags: [], origem: "outro", notas: "", atividades: [], tarefas: [],
    ...Object.fromEntries(Object.entries(l || {}).filter(([, v]) => v !== undefined))
  };
}

/* ---------- Persistência ---------- */
export function load() {
  let raw = null;
  try { raw = JSON.parse(lsGet(KEY) || "null"); } catch {}
  if (raw && raw.config) {
    state.leads = (raw.leads || []).map(migrateLead).map(normalizeLead);
    state.removidos = raw.removidos || {};
    state.config = { ...defaultConfig(raw.config.idioma), ...raw.config };
    state.configAt = raw.configAt || "";
    return;
  }
  state.config = defaultConfig();
  state.configAt = "";
  let old = [];
  try { old = JSON.parse(lsGet(OLD) || "[]"); } catch {}
  try { state.removidos = JSON.parse(lsGet(OLD + "-del") || "{}"); } catch { state.removidos = {}; }
  state.leads = old.map(migrateLead).map(normalizeLead);
  for (const l of state.leads) if (!l.valor && l.produtos.length) l.valor = productsValue(l.produtos);
  if (!old.length && !lsGet(OLD + "-seeded") && !lsGet(KEY + "-seeded")) state.leads = demoLeads();
  lsSet(KEY + "-seeded", "1");
  persist(true);
}

export function persist(fromSync = false) {
  lsSet(KEY, JSON.stringify({ v: 2, leads: state.leads, removidos: state.removidos, config: state.config, configAt: state.configAt }));
  subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  if (!fromSync) onPersist();
}

/* ---------- Consultas ---------- */
export const cfg = () => state.config;
export const getLead = id => state.leads.find(l => l.id === id);
export const stage = id => state.config.etapas.find(s => s.id === id) || state.config.etapas[0];
export const stageIndex = id => state.config.etapas.findIndex(s => s.id === id);
export const product = id => state.config.produtos.find(p => p.id === id);
export const isWon = l => stage(l.etapa)?.tipo === "ganho";
export const isLost = l => stage(l.etapa)?.tipo === "perdido";
export const isOpen = l => !isWon(l) && !isLost(l);
export const openStages = () => state.config.etapas.filter(s => !s.tipo);
export const nextTask = l => (l.tarefas || []).filter(x => !x.feita).sort((a, b) => (a.vence || "9").localeCompare(b.vence || "9"))[0];
export const lastActivity = l => (l.atividades || []).reduce((m, a) => (a.em > m ? a.em : m), l.criadoEm || "");
export const leadName = l => l.empresa || l.contato || t("lead.noName");

export function score(l) {
  if (isWon(l)) return 100;
  if (isLost(l)) return 0;
  const os = openStages(), i = Math.max(0, os.findIndex(s => s.id === l.etapa));
  let s = 18 + (os.length > 1 ? (i / (os.length - 1)) * 32 : 0);
  if (l.telefone) s += 6;
  if (l.telefone && isMobile(l.telefone, l.pais)) s += 4;
  if (l.email) s += 4;
  const tipos = (l.produtos || []).map(id => product(id)?.tipo);
  if (tipos.includes("site") && l.temSite === "nao") s += 12;
  if (tipos.includes("nfc") && l.avaliacoes != null && l.avaliacoes < 80) s += 10;
  if (+l.valor > 0) s += 4;
  const last = lastActivity(l);
  if (last && Date.now() - new Date(last) < 7 * 864e5) s += 10;
  const nt = nextTask(l);
  if (nt && nt.vence && nt.vence < todayISO()) s -= 12;
  return Math.round(clamp(s, 1, 99));
}
export const heat = sc => (sc >= 70 ? "hot" : sc >= 45 ? "warm" : "cold");

export function fitFor({ avaliacoes, temSite }) {
  const tipos = [];
  if (temSite === "nao") tipos.push("site");
  if (avaliacoes != null && avaliacoes !== "" && +avaliacoes < 80) tipos.push("nfc");
  const ids = state.config.produtos.filter(p => tipos.includes(p.tipo)).map(p => p.id);
  return ids.length ? ids : state.config.produtos.filter(p => p.tipo === "nfc").map(p => p.id).slice(0, 1);
}
export const productsValue = ids => ids.reduce((s, id) => s + (+product(id)?.preco || 0), 0);

/* ---------- Mutações ---------- */
function touch(l) { l.atualizadoEm = nowISO(); }

export function createLead(data, { atividade = true } = {}) {
  const l = normalizeLead({ ...data, id: data.id || uid("l"), criadoEm: data.criadoEm || nowISO() });
  if (!l.valor && l.produtos.length) l.valor = productsValue(l.produtos);
  if (atividade) l.atividades = [...(l.atividades || []), { id: uid("a"), tipo: "criado", texto: t("origem." + l.origem), em: l.criadoEm }];
  touch(l);
  state.leads.push(l);
  return l;
}
export function addLeads(list) { const out = list.map(d => createLead(d)); persist(); return out; }
export function saveLead(data) {
  const cur = data.id && getLead(data.id);
  if (!cur) { const l = createLead(data); persist(); return l; }
  const prevStage = cur.etapa;
  Object.assign(cur, data);
  if (prevStage !== cur.etapa) logStage(cur, prevStage);
  touch(cur); persist(); return cur;
}
function logStage(l, from) {
  l.atividades.push({ id: uid("a"), tipo: "etapa", texto: `${stage(from)?.nome || from} → ${stage(l.etapa)?.nome}`, em: nowISO() });
  if (isWon(l)) l.ganhoEm = nowISO(); else delete l.ganhoEm;
  if (isLost(l)) l.perdidoEm = nowISO(); else delete l.perdidoEm;
}
export function setStage(ids, etapa) {
  for (const id of [].concat(ids)) { const l = getLead(id); if (!l || l.etapa === etapa) continue; const from = l.etapa; l.etapa = etapa; logStage(l, from); touch(l); }
  persist();
}
export function updateMany(ids, fn) { for (const id of ids) { const l = getLead(id); if (l) { fn(l); touch(l); } } persist(); }
export function deleteLeads(ids) {
  const now = nowISO(), set = new Set([].concat(ids));
  set.forEach(id => { state.removidos[id] = now; });
  state.leads = state.leads.filter(l => !set.has(l.id));
  persist();
}
export function addActivity(id, tipo, texto, extra = {}) {
  const l = getLead(id); if (!l) return;
  l.atividades.push({ id: uid("a"), tipo, texto, em: nowISO(), ...extra });
  touch(l); persist();
}
export function removeActivity(id, aid) { const l = getLead(id); if (!l) return; l.atividades = l.atividades.filter(a => a.id !== aid); touch(l); persist(); }
export function addTask(id, titulo, vence) {
  const l = getLead(id); if (!l) return;
  l.tarefas.push({ id: uid("t"), titulo, vence: vence || todayISO(), feita: false, criadaEm: nowISO() });
  touch(l); persist();
}
export function toggleTask(id, tid) {
  const l = getLead(id); const k = l?.tarefas.find(x => x.id === tid); if (!k) return;
  k.feita = !k.feita; k.feitaEm = k.feita ? nowISO() : undefined;
  if (k.feita) l.atividades.push({ id: uid("a"), tipo: "tarefa", texto: k.titulo, em: nowISO() });
  touch(l); persist();
}
export function removeTask(id, tid) { const l = getLead(id); if (!l) return; l.tarefas = l.tarefas.filter(x => x.id !== tid); touch(l); persist(); }
export function updateConfig(patch) { Object.assign(state.config, patch); state.configAt = nowISO(); persist(); }

// Registro de mensagem enviada: atividade + avanço de etapa + retorno agendado.
export function logOutreach(id, canal, texto) {
  const l = getLead(id); if (!l) return;
  l.atividades.push({ id: uid("a"), tipo: canal, texto, em: nowISO() });
  const os = openStages();
  if (l.etapa === os[0]?.id && os[1]) { const from = l.etapa; l.etapa = os[1].id; logStage(l, from); }
  if (!nextTask(l)) l.tarefas.push({ id: uid("t"), titulo: t("task.followup"), vence: addDays(todayISO(), 2), feita: false, criadaEm: nowISO() });
  touch(l); persist();
}

export function replaceAll(data) {
  state.leads = (data.leads || []).map(migrateLead).map(normalizeLead);
  state.removidos = data.removidos || {};
  if (data.config) { state.config = { ...defaultConfig(data.config.idioma), ...data.config }; state.configAt = data.configAt || nowISO(); }
  persist();
}

/* ---------- Exemplos (só no primeiro uso) ---------- */
function demoLeads() {
  const d = n => addDays(todayISO(), n), ago = n => new Date(Date.now() - n * 864e5).toISOString();
  const mk = (o, days) => ({
    ...normalizeLead({ pais: "BR" }), id: uid("demo"), tags: ["exemplo"], criadoEm: ago(days), atualizadoEm: ago(Math.max(0, days - 2)),
    atividades: [{ id: uid("a"), tipo: "criado", texto: "", em: ago(days) }], ...o
  });
  return [
    mk({ empresa: "Barbearia Navalha", contato: "Rafael", cidade: "Campinas", segmento: "Barbearia", produtos: ["nfc"], etapa: "novo", valor: 150, avaliacoes: 18, nota: 4.8, origem: "prospeccao", tarefas: [{ id: uid("t"), titulo: t("task.firstContact"), vence: d(0), feita: false }] }, 1),
    mk({ empresa: "Pizzaria Forno a Lenha", contato: "Carla", cidade: "Campinas", segmento: "Pizzaria", produtos: ["nfc", "sites"], etapa: "contatado", valor: 1650, avaliacoes: 42, temSite: "nao", origem: "instagram", tarefas: [{ id: uid("t"), titulo: t("task.followup"), vence: d(-1), feita: false }] }, 6),
    mk({ empresa: "Studio Bella", contato: "Juliana", cidade: "Valinhos", segmento: "Salão de beleza", produtos: ["sites"], etapa: "proposta", valor: 1800, temSite: "nao", origem: "indicacao", tarefas: [{ id: uid("t"), titulo: t("task.sendProposal"), vence: d(1), feita: false }] }, 12),
    mk({ empresa: "Clínica Sorriso", contato: "Dra. Marina", cidade: "Valinhos", segmento: "Odontologia", produtos: ["sites"], etapa: "ganho", valor: 2200, origem: "indicacao", ganhoEm: ago(3) }, 25),
    mk({ empresa: "Pet Feliz", contato: "Bruno", cidade: "Sumaré", segmento: "Pet shop", produtos: ["nfc"], etapa: "qualificado", valor: 300, avaliacoes: 9, origem: "prospeccao" }, 9)
  ];
}
