'use strict';
/* =====================================================================
   AtivaPlays Painel (produção)
   Fala com o Supabase por 3 caminhos, nunca com SQL solto:
     - leitura:  supabase.from(tabela).select()  -> o RLS já filtra pela árvore
     - ações:    supabase.rpc(...)               -> transfer_credits, admin_grant_credits,
                                                    set_customer_blocked, upsert_customer_playlist
     - Edge Fn:  ativar_cliente, criar_revendedor (a parte que precisa de service_role)
   Sem build: este arquivo roda direto no navegador.
   ===================================================================== */

const DAY = 864e5;
const CFG = window.ATIVA_CONFIG || {};
const CONFIGURED = /^https?:\/\//.test(CFG.SUPABASE_URL || '') && (CFG.SUPABASE_ANON_KEY || '').length > 40 && !/COLE_AQUI/.test(CFG.SUPABASE_ANON_KEY);
const sb = (CONFIGURED && window.supabase)
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

/* ---------- Utilidades ---------- */
const ICON = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  tree: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4.5M12 12H5v4.5M12 12h7v4.5"/>',
  ledger: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h12v4"/><path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M21 9h-4a2 2 0 0 0 0 4h4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.7"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.2 5.6"/><path d="M20 4v7h-7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.8 3.1 2.5 3.5 5.2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  inf: '<path d="M6.5 8.5a3.5 3.5 0 1 0 0 7c3.5 0 7-7 11-7a3.5 3.5 0 1 1 0 7c-4 0-7.5-7-11-7z"/>',
  down: '<path d="M12 4v14M6 12l6 6 6-6"/>',
  up: '<path d="M12 20V6M6 12l6-6 6 6"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c.4-1 1.3-1.5 2.5-1.5 1.5 0 2.6.7 2.6 2s-1.1 1.7-2.6 2-2.6.7-2.6 2 1.1 2 2.6 2c1.2 0 2.1-.5 2.5-1.5"/>',
  repeat: '<path d="M17 3l4 4-4 4"/><path d="M3 11V9a2 2 0 0 1 2-2h16M7 21l-4-4 4-4"/><path d="M21 13v2a2 2 0 0 1-2 2H3"/>',
  out: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><path d="M16 8l4 4-4 4M20 12H9"/>',
  list: '<path d="M4 6h10M4 12h10M4 18h7"/><circle cx="18" cy="16" r="3"/><path d="M21 16V7l-3 1"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-5-5 8-8z"/><path d="M7 7l-4 4 5 5"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h8M8 11h6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V20a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 14H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.6V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H20a2 2 0 1 1 0 4h-.6z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  swap: '<path d="M7 4l-4 4 4 4"/><path d="M3 8h13a4 4 0 0 1 0 8h-1"/><path d="M17 20l4-4-4-4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18-3-3.5-3-14.5 0-18z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  trial: '<path d="M9 3h6M10 3v5L5.5 18A2 2 0 0 0 7.3 21h9.4a2 2 0 0 0 1.8-3L14 8V3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'
};
const ico = (n, c = '') => `<svg class="ico ${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = ms => new Date(ms).toLocaleDateString('pt-BR');
const fmtDT = ms => { const d = new Date(ms); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

/* meses de calendário, como o Postgres (31/jan + 1 mês = 28/fev). Só para a prévia: quem manda é o servidor. */
function addMonths(ms, n) {
  const d = new Date(ms), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d.getTime();
}
const MAC_RE = /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/;
const URL_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const normMac = s => String(s || '').trim().toUpperCase().replace(/-/g, ':');
const normKey = s => String(s || '').trim().toLowerCase().replace(/[-\s]/g, '');
const groupKey = k => normKey(k).toUpperCase().replace(/(.{4})(?=.)/g, '$1-');
const hostOf = u => { try { return new URL(u).host; } catch { return u; } };
const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const genPassword = () => {
  const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(12); crypto.getRandomValues(a);
  return Array.from(a, n => abc[n % abc.length]).join('');
};

/* ---------- Erros do servidor -> mensagem em português ---------- */
class AppError extends Error { constructor(msg, code = 'ERROR', http = 0) { super(msg); this.code = code; this.http = http; } }

function friendly(code, fallback, detail) {
  const need = /saldo=([\d.]+)\s+necessario=([\d.]+)/.exec(detail || '');
  switch (code) {
    case 'INSUFFICIENT_CREDITS': return need ? `Saldo insuficiente: você tem ${credTxt(need[1])} e precisa de ${credTxt(need[2])}.` : 'Saldo insuficiente.';
    case 'DEVICE_KEY_MISMATCH': return 'A Device Key não confere com a do aparelho cadastrado.';
    case 'CUSTOMER_BLOCKED': return 'Aparelho bloqueado. Desbloqueie-o antes de renovar.';
    case 'CUSTOMER_FORBIDDEN': return 'Este aparelho pertence a outra árvore de revenda. Você não pode alterá-lo.';
    case 'CUSTOMER_NOT_FOUND': return 'Aparelho não encontrado.';
    case 'CUSTOMER_EXISTS_RETRY': return 'Conflito ao cadastrar o aparelho. Tente novamente.';
    case 'PROFILE_INACTIVE': return 'Seu perfil está inativo ou não existe.';
    case 'WALLET_NOT_FOUND': return 'Carteira não encontrada.';
    case 'EMAIL_EXISTS': return 'Já existe um usuário com este e-mail.';
    case 'RESELLER_EXISTS': return 'Este usuário já tem perfil.';
    case 'INVALID_INPUT': return detail ? `Dados inválidos: ${detail}.` : (fallback || 'Dados inválidos.');
    default: return fallback || 'Algo deu errado. Tente de novo.';
  }
}

/* Edge Function: o corpo do erro vem em error.context (um Response) */
async function callFn(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (!error) return data;
  let payload = null, http = 0;
  try { if (error.context && typeof error.context.json === 'function') { http = error.context.status; payload = await error.context.json(); } } catch { /* corpo não era JSON */ }
  if (!payload) throw new AppError(error.name === 'FunctionsFetchError' ? 'Sem conexão com o servidor. Verifique a internet e tente de novo.' : 'O servidor não respondeu como esperado. A função foi publicada (deploy)?', 'NETWORK', http);
  throw new AppError(friendly(payload.code, payload.error, payload.detail), payload.code || 'ERROR', http);
}

/* RPC: os códigos vêm em error.message (raise exception 'CODIGO') */
async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (!error) return data;
  const m = error.message || '';
  if (/wallets_balance_check/.test(m)) throw new AppError('Saldo insuficiente.', 'INSUFFICIENT_CREDITS');
  if (/^[A-Z_]+$/.test(m)) throw new AppError(friendly(m, '', error.details), m);
  throw new AppError(m === 'Apenas admin' ? 'Apenas o Admin pode emitir créditos.' : (m || 'Falha na operação.'), error.code || 'ERROR');
}

/* ---------- Leitura (RLS filtra pela árvore do usuário logado) ---------- */
async function fetchAll(table, cols, orderCol, asc = true, max = 20000) {
  const out = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).order(orderCol, { ascending: asc }).range(from, from + 999);
    if (error) throw new AppError(`Erro ao ler ${table}: ${error.message}`, error.code || 'READ');
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/* O formulário de ativação começa (e volta) assim. */
const FORM0 = {
  mac: '', key: '', months: 12, plSel: '', kind: 'xtream',
  url: '', user: '', pass: '', m3u: '', showPass: false, name: ''
};

const S = {
  booting: true, session: null, noProfile: false, loading: false, loadedAt: 0, loadError: null,
  data: { profiles: [], wallets: {}, ledger: [], customers: [] },

  /* Uma página por vez; o menu lateral é quem troca. */
  route: 'painel', nav: false,

  q: '', cfilter: 'all', cLimit: 60,
  lfilter: 'all', lLimit: 80, rq: '', pq: '', pkind: 'all', plOpen: null,
  acct: { p1: '', p2: '', show: false, err: '', ok: false, busy: false },
  login: { email: '', pass: '', err: '', busy: false },
  form: { ...FORM0 },

  /* Ferramentas: transferir ativação e troca de domínio em massa. */
  tools: {
    t: { from: '', to: '', key: '', name: '', busy: false, err: '', ok: null },
    d: { from: '', to: '', busy: false, err: '', preview: null, matched: 0, applied: null }
  },

  reqId: uuid(), result: null, error: null, flashId: null, busy: false,
  modal: null, mf: {}
};

/* As páginas do menu, na ordem em que aparecem. */
const PAGES = [
  { group: 'Visão geral', items: [
    { id: 'painel', label: 'Painel', icon: 'grid' },
    { id: 'diretriz', label: 'Como revender', icon: 'book' },
  ]},
  { group: 'Gerenciamento', items: [
    { id: 'dispositivos', label: 'Aparelhos', icon: 'tv' },
    { id: 'revendedores', label: 'Revendedores', icon: 'users' },
    { id: 'creditos', label: 'Créditos', icon: 'coin' },
    { id: 'playlists', label: 'Listas', icon: 'list' },
    { id: 'ferramentas', label: 'Ferramentas', icon: 'tools' },
  ]},
  { group: 'Conta', items: [
    { id: 'ajustes', label: 'Ajustes', icon: 'gear' },
    { id: 'suporte', label: 'Suporte', icon: 'chat' },
  ]}
];
const pageOf = id => PAGES.flatMap(g => g.items).find(p => p.id === id) || PAGES[0].items[0];

async function loadAll() {
  S.loading = true; S.loadError = null; render();
  try {
    const uid = S.session.user.id;
    const [prof, wal, led, cus] = await Promise.all([
      fetchAll('profiles', 'id,role,parent_id,name,email,active,created_at', 'created_at'),
      fetchAll('wallets', 'owner_id,balance', 'owner_id'),
      fetchAll('credit_ledger', '*', 'id', false, 2000),
      fetchAll('customers', '*, playlists(id,kind,server_url,username,password,m3u_url,active,sort_order,created_at)', 'created_at')
    ]);
    S.data.profiles = prof.map(p => ({ id: p.id, role: p.role, parent: p.parent_id, name: p.name, email: p.email, active: p.active }));
    S.data.wallets = Object.fromEntries(wal.map(w => [w.owner_id, Number(w.balance)]));
    S.data.ledger = led.map(l => ({ id: Number(l.id), owner: l.wallet_owner, delta: Number(l.delta), balance_after: Number(l.balance_after), reason: l.reason, counterparty: l.counterparty, customer_id: l.customer_id, note: l.note, at: Date.parse(l.created_at) }));
    S.data.customers = cus.map(c => {
      // Xtream e M3U entram juntas: cada cliente tem UMA lista principal.
      const pls = (c.playlists || []).filter(p => p.active)
        .sort((a, b) => (a.sort_order - b.sort_order) || (Date.parse(a.created_at) - Date.parse(b.created_at)));
      const p = pls[0];
      return {
        id: c.id, reseller_id: c.reseller_id, mac: c.mac_address, key: c.device_key,
        name: c.name, status: c.status, expires_at: Date.parse(c.expires_at),
        created_at: Date.parse(c.created_at),
        playlist: p ? {
          kind: p.kind || 'xtream',
          url: p.server_url || '', user: p.username || '', pass: p.password || '',
          m3u: p.m3u_url || ''
        } : null
      };
    });
    S.noProfile = !S.data.profiles.some(p => p.id === uid && p.active);
    S.loadedAt = Date.now();
  } catch (e) {
    S.loadError = e.message || 'Não foi possível carregar os dados.';
  }
  S.loading = false; render();
}

/* ---------- Consultas locais ---------- */
const profile = id => S.data.profiles.find(p => p.id === id);
const me = () => profile(S.session.user.id);
const isAdm = () => me()?.role === 'admin';
const nameOf = id => profile(id)?.name || '—';
const myBalance = () => Number(S.data.wallets[me().id] ?? 0);

/* Preço de cada período, em créditos (o servidor confere de novo).
   12 meses = 1 crédito · 6 meses = 0,5 · 3 meses e 1 mês só para o Admin. */
const PRECOS = { 1: 0.1, 3: 0.25, 6: 0.5, 12: 1 };
const periodos = () => isAdm() ? [1, 3, 6, 12] : [6, 12];
const custo = m => PRECOS[m] ?? 0;
const r2 = n => Math.round(Number(n || 0) * 100) / 100;
const fmtC = n => r2(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const credTxt = n => `${fmtC(n)} ${r2(Math.abs(n)) < 2 ? 'crédito' : 'créditos'}`;
const parseNum = v => Number(String(v ?? '').trim().replace(',', '.')) || 0;
const fixMonths = f => { if (!periodos().includes(+f.months)) f.months = 12; };

/* Suporte: ativações, recarga de créditos e problemas, tudo neste WhatsApp. */
const SUPORTE_WA = '5511985108317';
const SUPORTE_TXT = '+55 11 98510-8317';
const waLink = msg => `https://wa.me/${SUPORTE_WA}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
const waBtn = (label, msg, extra = '') => `<a class="btn wa ${extra}" href="${waLink(msg)}" target="_blank" rel="noopener">${ico('chat')}${label}</a>`;
function subtree(rootId) {
  const out = new Set([rootId]); let grew = true;
  while (grew) { grew = false; for (const p of S.data.profiles) if (p.parent && out.has(p.parent) && !out.has(p.id)) { out.add(p.id); grew = true; } }
  return out;
}
const visibleCustomers = () => S.data.customers;
const visibleResellers = () => { const t = subtree(me().id); return S.data.profiles.filter(p => p.role === 'reseller' && t.has(p.id) && p.id !== me().id); };
const visibleLedger = () => S.data.ledger.filter(l => isAdm() || l.owner === me().id);
const depthOf = id => { let d = 0, p = profile(id); while (p && p.parent && p.parent !== me().id) { d++; p = profile(p.parent); } return d; };
const effStatus = (c, now = Date.now()) => c.status === 'blocked' ? 'blocked' : (c.expires_at <= now ? 'expired' : c.status);
const daysLeft = (c, now = Date.now()) => Math.ceil((c.expires_at - now) / DAY);
const isSoon = (c, now = Date.now()) => { const s = effStatus(c, now); return (s === 'active' || s === 'trial') && c.expires_at - now <= 7 * DAY; };
const bal = n => `<span class="num">${n}</span>`;

/* ---------- Listas de reprodução ---------- */
const plAddr = p => !p ? '' : (p.kind === 'm3u' ? p.m3u : p.url);
const plKey = p => !p ? '' : [p.kind, plAddr(p), p.user, p.pass].join('|');
const plTitle = p => !p ? '' : (p.kind === 'm3u' ? hostOf(p.m3u) : hostOf(p.url));
const plSub = p => !p ? '' : (p.kind === 'm3u' ? 'Lista M3U' : p.user);

/* A página "Listas" junta por SERVIDOR, não por login: no Xtream cada cliente tem
   o seu usuário, e uma linha por cliente não diria nada. Agrupado por endereço,
   dá para ver num relance quantos aparelhos dependem de cada fornecedor. */
const plHostKey = p => !p ? '' : p.kind + '|' + hostOf(plAddr(p));
function playlistGroups() {
  const map = new Map();
  for (const c of visibleCustomers()) {
    if (!c.playlist) continue;
    const k = plHostKey(c.playlist);
    const g = map.get(k) || { key: k, pl: c.playlist, customers: [], users: new Set() };
    g.customers.push(c);
    if (c.playlist.user) g.users.add(c.playlist.user);
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.customers.length - a.customers.length);
}

/* Já o formulário de ativação precisa do login inteiro para reaproveitar. */
function savedPlaylists() {
  const map = new Map();
  for (const c of visibleCustomers()) {
    if (!c.playlist) continue;
    const k = plKey(c.playlist);
    if (!map.has(k)) map.set(k, c.playlist);
  }
  return [...map.entries()];
}

/* Ativações por dia nos últimos 14 dias (o gráfico do Painel). */
function activationsByDay(days = 14) {
  const out = [], base = new Date(); base.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * DAY);
    out.push({ at: d.getTime(), label: `${d.getDate()}/${d.getMonth() + 1}`, n: 0 });
  }
  const first = out[0].at;
  for (const l of visibleLedger()) {
    if (l.reason !== 'customer_activation' || l.at < first) continue;
    const idx = Math.floor((l.at - first) / DAY);
    if (idx >= 0 && idx < out.length) out[idx].n += Math.abs(l.delta);
  }
  return out;
}

function configHelp() {
  return `<div class="center-screen"><div class="login-card setup">
    <div class="brand"><span class="logo">${ico('play')}</span><span>Ativa<b>Plays</b></span></div>
    <h2 style="margin:10px 0 6px">Falta configurar o Supabase</h2>
    <p class="sub">Abra o arquivo <code>config.js</code> (na mesma pasta do <code>index.html</code>) e cole os dois valores do seu projeto:</p>
    <pre>window.ATIVA_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
};</pre>
    <p class="hint">Eles ficam em Supabase &rsaquo; Project Settings &rsaquo; API. Use a chave <b>anon</b>, nunca a service_role.${window.supabase ? '' : '<br><b style="color:var(--bad)">A biblioteca do Supabase não carregou: confira sua conexão com a internet.</b>'}</p>
  </div></div>`;
}

function loginView() {
  const l = S.login;
  return `<div class="center-screen"><div class="login-card">
    <div class="brand"><span class="logo">${ico('play')}</span><span>Ativa<b>Plays</b> <span class="muted" style="font-weight:500;font-size:14px">Painel</span></span></div>
    <p class="sub">Entre com o e-mail e a senha do seu acesso de Admin ou Revendedor.</p>
    <form id="login-form" novalidate>
      <div class="f"><label for="l-email">E-mail</label><input class="in" id="l-email" data-login="email" type="email" autocomplete="username" inputmode="email" autocapitalize="off" value="${esc(l.email)}" required></div>
      <div class="f"><label for="l-pass">Senha</label><input class="in" id="l-pass" data-login="pass" type="password" autocomplete="current-password" value="${esc(l.pass)}" required></div>
      ${l.err ? `<div class="banner err" role="alert">${ico('alert')}<div>${esc(l.err)}</div></div>` : ''}
      <button type="submit" class="btn primary" ${l.busy ? 'disabled' : ''}>${l.busy ? spin + 'Entrando…' : 'Entrar'}</button>
    </form>
    <p class="hint" style="margin:16px 0 0">Esqueceu a senha ou precisa de ajuda? Chame o suporte no WhatsApp: <a href="${waLink('Olá! Preciso de ajuda para entrar no painel AtivaPlays.')}" target="_blank" rel="noopener">${SUPORTE_TXT}</a>.</p>
  </div></div>`;
}

function noProfileView() {
  return `<div class="center-screen"><div class="login-card">
    <h2 style="margin-bottom:8px">Seu usuário ainda não tem perfil</h2>
    <p class="sub">O login <b>${esc(S.session.user.email)}</b> existe, mas não está cadastrado como Admin nem Revendedor (ou está inativo).</p>
    <p class="hint" style="margin-bottom:16px">Se você é o dono do sistema, rode <code class="code">supabase/primeiro_admin.sql</code> com este e-mail. Se é revendedor, peça ao seu responsável para criar o seu acesso pelo painel.</p>
    <button class="btn" data-act="logout">${ico('out')}Sair</button>
  </div></div>`;
}


/* =====================================================================
   VISUAIS — moldura (menu lateral, topo) e páginas
   ===================================================================== */
function pill(c) {
  const s = effStatus(c);
  if (s === 'blocked') return `<span class="pill blocked">Bloqueado</span>`;
  if (s === 'expired') return `<span class="pill expired">Vencido</span>`;
  if (isSoon(c)) return `<span class="pill soon">${daysLeft(c)}d</span>`;
  return s === 'trial' ? `<span class="pill trial">Teste</span>` : `<span class="pill active">Ativo</span>`;
}
const spin = `<span class="spinner" aria-hidden="true"></span>`;
const brand = (size = '') => `<span class="brand ${size}"><span class="logo">${ico('play')}</span><span class="wordmark">Ativa<b>Plays</b></span></span>`;

/* ---------- Moldura ---------- */
function sidebar() {
  const r = S.route;
  return `<aside class="side ${S.nav ? 'open' : ''}" id="side">
    <div class="side-top">${brand()}<button class="icon-btn only-mobile" data-act="nav-close" aria-label="Fechar menu">${ico('x')}</button></div>
    <nav class="side-nav">
      ${PAGES.map(g => `
        <div class="side-group">${esc(g.group)}</div>
        ${g.items.map(p => `
          <button class="side-item ${r === p.id ? 'sel' : ''}" data-act="go" data-page="${p.id}">
            ${ico(p.icon)}<span>${esc(p.label)}</span>
            ${p.id === 'dispositivos' && soonCount() ? `<em class="dot-badge">${soonCount()}</em>` : ''}
          </button>`).join('')}
      `).join('')}
    </nav>
    <div class="side-foot">
      <div class="who">
        <span class="avatar">${esc(initials(me()?.name))}</span>
        <div style="min-width:0">
          <div class="t">${esc(me()?.name || '')}</div>
          <small class="muted">${isAdm() ? 'Administrador' : 'Revendedor'}</small>
        </div>
      </div>
      <button class="btn sm ghost full" data-act="logout">${ico('out')}Sair</button>
    </div>
  </aside>`;
}

const soonCount = () => visibleCustomers().filter(c => isSoon(c)).length;

function topbar() {
  const p = pageOf(S.route);
  const saldo = myBalance();
  return `<header class="top">
    <button class="icon-btn only-mobile" data-act="nav-open" aria-label="Abrir menu">${ico('menu')}</button>
    <div class="crumb">
      <span class="muted">Painel</span>
      <span class="sep">•</span>
      <b>${esc(p.label)}</b>
    </div>
    <div class="top-actions">
      <button class="wallet" data-act="go" data-page="creditos" title="Seus créditos">
        ${ico('coin')}<b>${isAdm() ? '∞' : fmtC(saldo)}</b>
      </button>
      <button class="icon-btn" data-act="refresh" title="Atualizar dados" ${S.loading ? 'disabled' : ''}>
        ${S.loading ? spin : ico('refresh')}
      </button>
    </div>
  </header>`;
}

function shell(body) {
  return `${sidebar()}
  <div class="scrim ${S.nav ? 'on' : ''}" data-act="nav-close"></div>
  <div class="main">
    ${topbar()}
    <main class="page">
      ${S.loadError ? `<div class="banner err" role="alert">${ico('alert')}<div><b>Não foi possível atualizar os dados.</b><div class="muted" style="font-size:12px">${esc(S.loadError)}</div></div></div>` : ''}
      ${body}
    </main>
  </div>`;
}

/* Cabeçalho de página: título, explicação curta e botões de ação. */
function pageHead(title, sub, actions = '') {
  return `<div class="page-head">
    <div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </div>`;
}

/* ---------- Painel (visão geral) ---------- */
function kpi(label, value, icon, tone = '', action = '') {
  return `<button class="kpi ${tone}" ${action}>
    <span class="kpi-ico">${ico(icon)}</span>
    <span class="kpi-v">${value}</span>
    <span class="kpi-l">${esc(label)}</span>
  </button>`;
}

function sparkline(days) {
  const max = Math.max(1, ...days.map(d => d.n));
  return `<div class="spark" role="img" aria-label="Ativações por dia nos últimos ${days.length} dias">
    ${days.map(d => `<i style="height:${Math.max(4, Math.round(d.n / max * 100))}%" title="${d.label}: ${d.n}"></i>`).join('')}
    <div class="spark-x"><span>${days[0].label}</span><span>${days[days.length - 1].label}</span></div>
  </div>`;
}

function dashboard() {
  const now = Date.now();
  const cs = visibleCustomers();
  const k = { total: cs.length, active: 0, soon: 0, expired: 0, blocked: 0, trial: 0 };
  cs.forEach(c => {
    const s = effStatus(c, now);
    if (s === 'active') k.active++; if (s === 'trial') k.trial++;
    if (s === 'expired') k.expired++; if (s === 'blocked') k.blocked++;
    if (isSoon(c, now)) k.soon++;
  });
  const days = activationsByDay(14);
  const mes = days.reduce((a, d) => a + d.n, 0);
  const subs = visibleResellers();
  const semLista = cs.filter(c => !c.playlist).length;

  const vencendo = cs.filter(c => isSoon(c, now)).sort((a, b) => a.expires_at - b.expires_at).slice(0, 6);

  return `
  ${pageHead('Painel', `Olá, ${me()?.name || ''}. Aqui está o resumo da sua operação.`,
    `<button class="btn primary" data-act="go" data-page="dispositivos" data-focus="f-mac">${ico('bolt')}Ativar aparelho</button>`)}

  <div class="kpis">
    ${kpi('Aparelhos', k.total, 'tv', '', 'data-act="go" data-page="dispositivos"')}
    ${kpi('Ativos', k.active, 'check', 'ok', 'data-act="goto-filter" data-filter="active"')}
    ${kpi('Vencendo em 7 dias', k.soon, 'clock', k.soon ? 'warn' : '', 'data-act="goto-filter" data-filter="soon"')}
    ${kpi('Vencidos', k.expired, 'alert', k.expired ? 'bad' : '', 'data-act="goto-filter" data-filter="expired"')}
    ${kpi('Em teste', k.trial, 'trial', '', 'data-act="goto-filter" data-filter="trial"')}
    ${kpi('Bloqueados', k.blocked, 'lock', '', 'data-act="goto-filter" data-filter="blocked"')}
  </div>

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><div><h2>Ativações</h2><div class="muted sm">Últimos 14 dias · ${fmtC(mes)} crédito(s) usados</div></div>
        <button class="btn sm ghost" data-act="go" data-page="creditos">${ico('ledger')}Extrato</button></div>
      ${sparkline(days)}
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Vencendo primeiro</h2><div class="muted sm">Quem precisa de renovação agora</div></div></div>
      ${vencendo.length ? `<div class="mini-list">${vencendo.map(c => `
        <div class="mini-row">
          <div style="min-width:0">
            <div class="t mono">${esc(c.mac)}</div>
            <small class="muted">${esc(c.name || nameOf(c.reseller_id))} · vence ${fmtDate(c.expires_at)}</small>
          </div>
          ${pill(c)}
          <button class="btn sm" data-act="renew" data-id="${c.id}" ${S.busy ? 'disabled' : ''}>${ico('repeat')}Renovar</button>
        </div>`).join('')}</div>`
      : `<div class="empty">${ico('check')}<div>Ninguém vencendo nos próximos 7 dias.</div></div>`}
    </section>
  </div>

  <div class="grid-3">
    <section class="card tight">
      <div class="card-head"><h2>Revendedores</h2></div>
      <div class="big">${subs.length}</div>
      <div class="muted sm">${subs.length ? 'na sua árvore' : 'nenhum ainda'}</div>
      <button class="btn sm full" data-act="go" data-page="revendedores">${ico('users')}Gerenciar</button>
    </section>
    <section class="card tight">
      <div class="card-head"><h2>Listas</h2></div>
      <div class="big">${playlistGroups().length}</div>
      <div class="muted sm">${semLista ? semLista + ' aparelho(s) sem lista' : 'todos os aparelhos com lista'}</div>
      <button class="btn sm full" data-act="go" data-page="playlists">${ico('list')}Ver listas</button>
    </section>
    <section class="card tight">
      <div class="card-head"><h2>Seus créditos</h2></div>
      <div class="big">${isAdm() ? '∞' : fmtC(myBalance())}</div>
      <div class="muted sm">${isAdm() ? 'admin emite na hora' : '12 meses = 1 crédito · 6 meses = 0,5'}</div>
      <button class="btn sm full" data-act="go" data-page="creditos">${ico('coin')}Extrato</button>
      ${isAdm() ? '' : waBtn('Recarregar créditos', `Olá! Quero recarregar créditos no AtivaPlays. Conta: ${me()?.email || ''}`, 'sm full')}
    </section>
  </div>`;
}

/* ---------- Aparelhos: ativação + lista ---------- */
function planPreview() {
  const f = S.form, adm = isAdm(), now = Date.now();
  fixMonths(f);
  const m = normMac(f.mac), k = normKey(f.key), months = +f.months, cost = custo(months);
  const macOk = MAC_RE.test(m), keyOk = /^[0-9a-f]{12}$/.test(k);
  const ex = macOk ? S.data.customers.find(c => c.mac === m) : null;
  let note = '', cls = 'ok';
  if (ex && keyOk && ex.key !== k) { note = 'A Device Key não confere com a do aparelho cadastrado: a ativação será recusada.'; cls = 'bad'; }
  else if (ex && ex.status === 'blocked') { note = 'Aparelho bloqueado: desbloqueie antes de renovar.'; cls = 'bad'; }
  else if (ex) { note = `Aparelho já cadastrado (${nameOf(ex.reseller_id)}). A renovação soma a partir de ${fmtDate(Math.max(now, ex.expires_at))}.`; cls = 'ok'; }
  else if (macOk && keyOk) { note = 'Aparelho novo: será criado como ativo a partir de hoje.'; cls = 'ok'; }
  const base = ex ? Math.max(now, ex.expires_at) : now;
  const newExp = addMonths(base, months);
  const afterBal = r2(myBalance() - cost);
  const short = !adm && afterBal < 0;
  const hasPl = formHasPlaylist(f);
  const noPl = !hasPl && !(ex && ex.playlist);
  return `
    <div class="kv"><span>Custo</span><b class="num">${credTxt(cost)}</b></div>
    <div class="kv"><span>Saldo após</span><b class="num ${short ? 'bad' : ''}">${adm ? '∞' : fmtC(afterBal)}</b></div>
    <div class="kv"><span>Nova validade (estimada)</span><b class="num">${fmtDate(newExp)}</b></div>
    ${short ? `<div class="note bad">${ico('alert')}Saldo insuficiente: faltam ${credTxt(-afterBal)}. Recarregue pelo WhatsApp ${SUPORTE_TXT}.</div>` : ''}
    ${note ? `<div class="note ${cls}">${ico(cls === 'bad' ? 'alert' : 'check')}${esc(note)}</div>` : ''}
    ${noPl ? `<div class="note warn">${ico('alert')}Sem lista: o cliente verá “Nenhuma lista cadastrada” no app até você cadastrar uma.</div>` : ''}`;
}

/* O formulário tem lista preenchida? Depende do tipo escolhido. */
const formHasPlaylist = f => f.kind === 'm3u'
  ? String(f.m3u).trim() !== ''
  : (String(f.url).trim() !== '' || String(f.user).trim() !== '' || String(f.pass) !== '');

function playlistFields(f, prefix = 'f') {
  const sp = savedPlaylists();
  return `
  <div class="section-title">
    <span>Lista de reprodução</span>
    <div class="seg" role="group" aria-label="Tipo de lista">
      <button type="button" class="seg-b ${f.kind === 'xtream' ? 'on' : ''}" data-act="pl-kind" data-kind="xtream" data-where="${prefix}">Painel (Xtream)</button>
      <button type="button" class="seg-b ${f.kind === 'm3u' ? 'on' : ''}" data-act="pl-kind" data-kind="m3u" data-where="${prefix}">Link M3U</button>
    </div>
  </div>

  ${prefix === 'f' && sp.length ? `
  <div class="f c12"><label for="f-plsel">Reaproveitar uma lista que você já usa</label>
    <select class="in" id="f-plsel" data-change="plsel">
      <option value="">Nova lista…</option>
      ${sp.map(([k, p]) => `<option value="${esc(k)}" ${f.plSel === k ? 'selected' : ''}>${p.kind === 'm3u' ? '[M3U] ' : ''}${esc(plTitle(p))}${p.kind === 'm3u' ? '' : ' — ' + esc(p.user)}</option>`).join('')}
    </select>
  </div>` : ''}

  ${f.kind === 'm3u' ? `
    <div class="f c12"><label for="${prefix}-m3u">Link da lista (.m3u / .m3u8)</label>
      <input class="in mono" id="${prefix}-m3u" data-field="m3u" placeholder="http://servidor.com/get.php?username=joao&password=1234&type=m3u_plus"
             value="${esc(f.m3u)}" autocapitalize="off" spellcheck="false">
      <span class="hint">Cole o link inteiro, do jeito que o fornecedor mandou. O app baixa essa lista direto — não precisa de usuário e senha separados.</span></div>
  ` : `
    <div class="f c12"><label for="${prefix}-url">Endereço do painel</label>
      <input class="in mono" id="${prefix}-url" data-field="url" placeholder="http://servidor.com:8080" value="${esc(f.url)}" autocapitalize="off" spellcheck="false">
      <span class="hint">Só o endereço, sem /player_api.php e sem barra no fim.</span></div>
    <div class="f c6"><label for="${prefix}-user">Usuário</label>
      <input class="in mono" id="${prefix}-user" data-field="user" value="${esc(f.user)}" autocapitalize="off" spellcheck="false"></div>
    <div class="f c6"><label for="${prefix}-pass">Senha</label>
      <div class="pw"><input class="in mono" id="${prefix}-pass" data-field="pass" type="${f.showPass ? 'text' : 'password'}" value="${esc(f.pass)}" autocapitalize="off" spellcheck="false">
      <button type="button" class="link" data-act="toggle-pass">${f.showPass ? 'Ocultar' : 'Mostrar'}</button></div></div>
  `}`;
}

function activationCard() {
  const f = S.form;
  const exists = MAC_RE.test(normMac(f.mac)) && S.data.customers.some(c => c.mac === normMac(f.mac));
  const r = S.result, e = S.error;
  return `
  <section class="card accent" id="activation">
    <div class="card-head">
      <div><h2>${exists ? 'Renovar' : 'Ativar'} aparelho</h2>
        <div class="muted sm">Confere os dados, cobra a carteira, grava o cliente e a lista — tudo numa transação só.</div></div>
      <button class="btn sm ghost" data-act="clear-form">${ico('x')}Limpar</button>
    </div>

    <form id="act-form" class="form-grid" autocomplete="off" novalidate>
      <div class="f c4"><label for="f-mac">Endereço MAC</label>
        <input class="in mono" id="f-mac" data-field="mac" inputmode="text" placeholder="A4:5E:60:C8:1F:2B" maxlength="17" value="${esc(f.mac)}">
        <span class="hint">O código que aparece na tela de ativação do aparelho.</span></div>

      <div class="f c4"><label for="f-key">Device Key</label>
        <input class="in mono" id="f-key" data-field="key" placeholder="7F3A-9C21-B4E8" maxlength="14" value="${esc(f.key)}">
        <span class="hint">Os 12 caracteres da mesma tela (com ou sem hífen).</span></div>

      <div class="f c4"><label for="f-months">Período</label>
        <select class="in" id="f-months" data-change="months">
          ${(fixMonths(f), periodos()).map(n => `<option value="${n}" ${+f.months === n ? 'selected' : ''}>${n} ${n === 1 ? 'mês' : 'meses'} — ${credTxt(custo(n))}</option>`).join('')}
        </select>
        <div class="chips" role="group" aria-label="Atalhos de período">
          ${periodos().map(n => `<button type="button" class="chip" data-act="months" data-n="${n}" aria-pressed="${+f.months === n}">${n}m</button>`).join('')}
        </div></div>

      ${playlistFields(f, 'f')}

      <div class="preview" id="act-preview">${planPreview()}</div>

      <div class="form-foot">
        <button type="button" class="btn ghost" data-act="open-trial">${ico('trial')}Cadastrar sem crédito (teste)</button>
        <button type="submit" class="btn primary lg" id="act-submit" ${S.busy ? 'disabled' : ''}>
          ${S.busy ? spin : ico('check')}<span id="act-label">${S.busy ? 'Processando…' : (exists ? 'Renovar cliente' : 'Ativar cliente')}</span>
        </button>
      </div>
    </form>

    ${e ? `<div class="banner err" role="alert">${ico('alert')}<div><b>${esc(e.message)}</b>
      <div class="muted sm">${e.http ? 'HTTP ' + e.http + ' · ' : ''}<span class="code">${esc(e.code)}</span> · nenhum crédito foi cobrado.</div></div></div>` : ''}

    ${r ? `<div class="banner ok"><span style="color:var(--ok)">${ico('check')}</span><div style="min-width:0;flex:1">
      <b>${r.res.replay ? 'Pedido repetido: devolvemos o resultado anterior, sem cobrar de novo.' : r.res.created ? 'Aparelho ativado.' : 'Aparelho renovado.'}</b>
      <div class="muted sm">${esc(r.res.mac_address)} · vence ${fmtDate(Date.parse(r.res.expires_at))}${isAdm() ? '' : ' · saldo ' + fmtC(r.res.balance_after)}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
        <button class="btn sm" data-act="replay" ${S.busy ? 'disabled' : ''}>${ico('repeat')}Reenviar o mesmo pedido</button>
      </div></div></div>` : ''}
  </section>`;
}

function devicesView() {
  const now = Date.now();
  let cs = visibleCustomers().slice();
  const counts = { all: cs.length, active: 0, soon: 0, expired: 0, blocked: 0, trial: 0, nopl: 0 };
  cs.forEach(c => {
    const s = effStatus(c, now);
    if (s === 'active') counts.active++; if (s === 'trial') counts.trial++;
    if (s === 'expired') counts.expired++; if (s === 'blocked') counts.blocked++;
    if (isSoon(c, now)) counts.soon++; if (!c.playlist) counts.nopl++;
  });

  cs = cs.filter(c => {
    const s = effStatus(c, now);
    if (S.cfilter === 'soon' && !isSoon(c, now)) return false;
    if (S.cfilter === 'nopl' && c.playlist) return false;
    if (['active', 'expired', 'blocked', 'trial'].includes(S.cfilter) && s !== S.cfilter) return false;
    const q = S.q.trim().toLowerCase();
    return !q || c.mac.toLowerCase().includes(q)
      || (c.name || '').toLowerCase().includes(q)
      || nameOf(c.reseller_id).toLowerCase().includes(q)
      || (c.playlist && plTitle(c.playlist).toLowerCase().includes(q));
  }).sort((a, b) => a.expires_at - b.expires_at);

  const shown = cs.slice(0, S.cLimit);
  const F = [
    ['all', 'Todos', counts.all], ['active', 'Ativos', counts.active], ['soon', 'Vencendo', counts.soon],
    ['expired', 'Vencidos', counts.expired], ['trial', 'Teste', counts.trial],
    ['blocked', 'Bloqueados', counts.blocked], ['nopl', 'Sem lista', counts.nopl]
  ];

  return `
  ${pageHead('Aparelhos', 'Ative, renove, troque a lista ou bloqueie — tudo daqui.',
    `<button class="btn ghost" data-act="go" data-page="ferramentas">${ico('swap')}Transferir ativação</button>`)}

  ${activationCard()}

  <section class="card" id="c-list-anchor">
    <div class="filters">
      <div class="search">${ico('search')}
        <input class="in" id="f-q" data-field="q" placeholder="Buscar por MAC, nome, revendedor ou servidor" value="${esc(S.q)}" autocapitalize="off">
        ${S.q ? `<button class="icon-btn sm" data-act="clear-q" aria-label="Limpar busca">${ico('x')}</button>` : ''}
      </div>
      <div class="chips scroll-x">
        ${F.map(([id, label, n]) => `<button class="chip ${S.cfilter === id ? 'on' : ''}" data-act="cfilter" data-f="${id}">${label}<em>${n}</em></button>`).join('')}
      </div>
    </div>

    <div class="muted sm" style="margin:2px 0 10px">${cs.length} aparelho(s) encontrados</div>

    ${shown.length ? `<div class="rows">${shown.map(c => deviceRow(c)).join('')}</div>` : `
      <div class="empty">${ico('search')}<div>Nada encontrado com esse filtro.</div></div>`}

    ${cs.length > shown.length ? `<button class="btn ghost full" data-act="more-customers">Mostrar mais ${Math.min(60, cs.length - shown.length)}</button>` : ''}
  </section>`;
}

function deviceRow(c) {
  const p = c.playlist;
  const flash = S.flashId === c.id ? ' flash' : '';
  return `<article class="row${flash}" id="c-${c.id}">
    <div class="row-main">
      <div class="row-id">
        <span class="mono t">${esc(c.mac)}</span>
        ${pill(c)}
      </div>
      <div class="row-sub muted">
        ${esc(c.name || 'sem nome')} · ${esc(nameOf(c.reseller_id))} · vence ${fmtDate(c.expires_at)}
      </div>
      <div class="row-pl">
        ${p ? `<span class="tag ${p.kind}">${p.kind === 'm3u' ? 'M3U' : 'XTREAM'}</span><span class="mono sm">${esc(plTitle(p))}</span>${p.kind === 'xtream' ? `<small class="muted mono">${esc(p.user)}</small>` : ''}`
            : `<span class="tag none">sem lista</span>`}
      </div>
    </div>
    <div class="row-acts">
      <button class="btn sm" data-act="renew" data-id="${c.id}" ${S.busy ? 'disabled' : ''} title="Renovar ${isAdm() ? '1 mês' : '6 meses'}">${ico('repeat')}<span class="only-wide">Renovar</span></button>
      <button class="btn sm" data-act="edit-pl" data-id="${c.id}" title="Editar a lista">${ico('list')}<span class="only-wide">Lista</span></button>
      <button class="btn sm ${c.status === 'blocked' ? 'warn' : ''}" data-act="block" data-id="${c.id}" ${S.busy ? 'disabled' : ''} title="${c.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}">
        ${ico(c.status === 'blocked' ? 'unlock' : 'lock')}<span class="only-wide">${c.status === 'blocked' ? 'Liberar' : 'Bloquear'}</span></button>
      <button class="btn sm" data-act="open-move" data-id="${c.id}" title="Transferir para outro aparelho">${ico('swap')}</button>
    </div>
  </article>`;
}

function resellersView() {
  const adm = isAdm();
  const list = [];
  (function walk(id) { S.data.profiles.filter(p => p.parent === id && p.role === 'reseller').forEach(p => { list.push(p); walk(p.id); }); })(me().id);
  const countC = id => S.data.customers.filter(c => c.reseller_id === id).length;
  return `
  ${pageHead('Revendedores', adm ? 'Todos os revendedores da plataforma, em árvore.' : 'Quem está abaixo de você. Créditos só passam para filhos diretos.',
    `<button class="btn" data-act="open-newsub">${ico('plus')}Novo revendedor</button>
     <button class="btn primary" data-act="open-transfer" ${list.length ? '' : 'disabled'}>${ico(adm ? 'coin' : 'send')}${adm ? 'Emitir créditos' : 'Transferir créditos'}</button>`)}
  <section class="card">
    ${list.length ? list.map(p => {
      const d = depthOf(p.id), directChild = p.parent === me().id;
      return `<div class="rrow">
        <div class="rname"><span class="tree" aria-hidden="true">${'<i></i>'.repeat(d)}</span><span class="avatar">${esc(initials(p.name))}</span><div style="min-width:0"><strong class="t" style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}${p.active ? '' : ' <span class="tag">inativo</span>'}</strong><small class="muted" style="display:block;overflow:hidden;text-overflow:ellipsis">${esc(p.email)}${p.parent !== me().id ? ' · sub de ' + esc(nameOf(p.parent)) : ''}</small></div></div>
        <div class="hide-m"><span class="tag ${directChild ? 'direct' : ''}">${directChild ? 'filho direto' : 'nível ' + (d + 1)}</span><small class="muted" style="display:block;margin-top:3px">${countC(p.id)} aparelho(s)</small></div>
        <div><b class="num" style="font-family:var(--font-display);font-size:18px">${fmtC(S.data.wallets[p.id] ?? 0)}</b><small class="muted" style="display:block">créditos</small></div>
        <button class="btn sm" data-act="open-transfer" data-target="${p.id}" ${(directChild || adm) ? '' : 'disabled title="Só é possível repassar para filhos diretos"'}>${ico(adm ? 'coin' : 'send')}${adm ? 'Emitir' : 'Transferir'}</button>
      </div>`;
    }).join('') : `<div class="empty">${S.loading ? 'Carregando…' : `Você ainda não tem sub-revendedores.<br><button class="btn primary" style="margin-top:12px" data-act="open-newsub">${ico('plus')}Criar o primeiro</button>`}</div>`}
  </section>`;
}

/* ---------- Extrato ---------- */
function kindOf(l) {
  const K = { admin_grant: ['grant', 'coin', 'Emissão'], transfer_in: ['in', 'down', 'Transferência recebida'], transfer_out: ['out', 'up', 'Transferência enviada'], customer_activation: ['act', 'tv', 'Ativação de MAC'], refund: ['in', 'refresh', 'Estorno'], adjustment: ['act', 'edit', 'Ajuste'] };
  const [c, i, t] = K[l.reason] || ['act', 'edit', l.reason];
  return `<span class="kind ${c}">${ico(i)}${t}</span>`;
}
function descOf(l) {
  if (l.reason === 'transfer_in') return `Recebido de ${nameOf(l.counterparty)}`;
  if (l.reason === 'transfer_out') return `Repassado para ${nameOf(l.counterparty)}`;
  return l.note || '—';
}
function creditsView() {
  const adm = isAdm(), all = visibleLedger();
  const rowsAll = all.filter(l => S.lfilter === 'all' || l.reason === S.lfilter);
  const rows = rowsAll.slice(0, S.lLimit);
  const inn = all.filter(l => l.delta > 0).reduce((a, l) => a + l.delta, 0), out = all.filter(l => l.delta < 0).reduce((a, l) => a - l.delta, 0);
  const F = [['all', 'Tudo'], ['admin_grant', 'Emissões'], ['transfer_out', 'Enviadas'], ['transfer_in', 'Recebidas'], ['customer_activation', 'Ativações']];
  return `
  ${pageHead('Créditos', 'Cada linha guarda o saldo depois da operação. O banco recusa alterar ou apagar qualquer uma.',
    `<span class="integrity ok">${ico('shield')}Extrato imutável</span>`)}
  <section class="sumrow">
    <div class="card stat"><div class="label">${ico('down')}Entradas</div><div class="value num" style="color:var(--ok)">+${fmtC(inn)}</div></div>
    <div class="card stat"><div class="label">${ico('up')}Saídas</div><div class="value num" style="color:var(--bad)">−${fmtC(out)}</div></div>
    <div class="card stat"><div class="label">${ico('wallet')}Saldo atual</div><div class="value num">${adm ? '∞' : fmtC(myBalance())}</div></div>
  </section>
  <section class="card">
    <div class="toolbar">
      <div class="chips" role="group" aria-label="Filtro por tipo">${F.map(([id, l]) => `<button class="chip" data-act="lfilter" data-f="${id}" aria-pressed="${S.lfilter === id}">${l}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="copy-csv">${ico('copy')}Copiar CSV</button></div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>#</th><th>Data</th><th>Tipo</th>${adm ? '<th>Carteira</th>' : ''}<th>Descrição</th><th class="r">Δ créditos</th><th class="r">Saldo após</th></tr></thead>
      <tbody>${rows.length ? rows.map(l => `<tr>
        <td class="num muted">${l.id}</td><td class="num" style="white-space:nowrap">${fmtDT(l.at)}</td><td>${kindOf(l)}</td>
        ${adm ? `<td style="white-space:nowrap">${esc(nameOf(l.owner))}</td>` : ''}
        <td style="min-width:200px">${esc(descOf(l))}</td>
        <td class="r num delta ${l.delta > 0 ? 'pos' : 'neg'}"><b>${l.delta > 0 ? '+' : ''}${fmtC(l.delta)}</b></td>
        <td class="r num">${profile(l.owner)?.role === 'admin' ? '—' : fmtC(l.balance_after)}</td></tr>`).join('') : `<tr><td colspan="${adm ? 7 : 6}" class="empty">${S.loading ? 'Carregando…' : 'Nenhuma movimentação neste filtro.'}</td></tr>`}</tbody>
    </table></div>
    ${rowsAll.length > rows.length ? `<div style="text-align:center;margin-top:14px"><button class="btn" data-act="more-ledger">Mostrar mais (${rowsAll.length - rows.length} restantes)</button></div>` : ''}
    ${S.data.ledger.length >= 2000 ? `<p class="hint" style="margin:12px 0 0">Mostrando as 2000 movimentações mais recentes.</p>` : ''}
  </section>`;
}


/* ---------- Listas de reprodução ---------- */
function plTag(p) {
  return p.kind === 'm3u'
    ? `<span class="tag m3u">M3U</span>`
    : `<span class="tag xt">Xtream</span>`;
}

function playlistsView() {
  const q = S.pq.trim().toLowerCase();
  let groups = playlistGroups();
  if (S.pkind !== 'all') groups = groups.filter(g => g.pl.kind === S.pkind);
  if (q) groups = groups.filter(g =>
    plAddr(g.pl).toLowerCase().includes(q) ||
    String(g.pl.user || '').toLowerCase().includes(q) ||
    g.customers.some(c => c.mac.toLowerCase().includes(q)));

  const semLista = visibleCustomers().filter(c => !c.playlist);
  const nM3u = playlistGroups().filter(g => g.pl.kind === 'm3u').length;
  const nXt = playlistGroups().filter(g => g.pl.kind === 'xtream').length;

  return `
  ${pageHead('Listas de reprodução', 'Uma linha por lista. Painel (Xtream) com usuário e senha, ou link M3U direto — o app aceita os dois.',
    `<button class="btn" data-act="go" data-page="ferramentas" data-focus="t-dfrom">${ico('globe')}Trocar domínio em massa</button>
     <button class="btn primary" data-act="go" data-page="dispositivos" data-focus="f-mac">${ico('plus')}Nova lista num aparelho</button>`)}

  <div class="toolbar">
    <div class="searchbox">
      ${ico('search')}
      <input class="in" id="pl-q" data-change="pq" value="${esc(S.pq)}" placeholder="Buscar por endereço, usuário ou MAC" autocapitalize="off" spellcheck="false">
      ${S.pq ? `<button class="x" data-act="clear-pq" aria-label="Limpar busca">${ico('x')}</button>` : ''}
    </div>
    <div class="seg" role="group" aria-label="Tipo de lista">
      <button class="seg-b ${S.pkind === 'all' ? 'on' : ''}" data-act="pkind" data-kind="all">Todas (${nXt + nM3u})</button>
      <button class="seg-b ${S.pkind === 'xtream' ? 'on' : ''}" data-act="pkind" data-kind="xtream">Xtream (${nXt})</button>
      <button class="seg-b ${S.pkind === 'm3u' ? 'on' : ''}" data-act="pkind" data-kind="m3u">M3U (${nM3u})</button>
    </div>
  </div>

  ${semLista.length ? `
  <div class="banner warn">${ico('alert')}<div style="flex:1;min-width:0">
    <b>${semLista.length} aparelho(s) ativados sem lista.</b>
    <div class="muted sm">Eles entram no app, mas abrem vazios até você cadastrar a lista.</div>
    <div class="row-acts" style="margin-top:10px">
      ${semLista.slice(0, 6).map(c => `<button class="btn sm" data-act="open-pl" data-id="${c.id}">${ico('list')}${esc(c.mac)}</button>`).join('')}
      ${semLista.length > 6 ? `<button class="btn sm ghost" data-act="goto-filter" data-filter="nopl">Ver todos</button>` : ''}
    </div>
  </div></div>` : ''}

  ${groups.length ? groups.map(g => {
    const open = S.plOpen === g.key;
    const m3u = g.pl.kind === 'm3u';
    return `
    <section class="card pl-card">
      <div class="pl-head">
        <span class="pl-ico ${m3u ? 'm3u' : ''}">${ico(m3u ? 'link' : 'tv')}</span>
        <div class="pl-id">
          <div class="pl-t">${plTag(g.pl)}<b class="mono">${esc(plTitle(g.pl))}</b></div>
          <small class="muted mono">${m3u ? esc(plAddr(g.pl).slice(0, 72)) + (plAddr(g.pl).length > 72 ? '…' : '') : g.users.size + (g.users.size === 1 ? ' usuário' : ' usuários') + ' neste servidor'}</small>
        </div>
        <div class="pl-n"><b class="num">${g.customers.length}</b><small class="muted">aparelho${g.customers.length === 1 ? '' : 's'}</small></div>
        <div class="row-acts">
          <button class="btn sm ghost" data-act="copy-pl" data-key="${esc(g.key)}">${ico('copy')}Copiar endereço</button>
          <button class="btn sm" data-act="pl-dns" data-host="${esc(hostOf(plAddr(g.pl)))}">${ico('globe')}Trocar domínio</button>
          <button class="btn sm" data-act="pl-open" data-key="${esc(g.key)}" aria-expanded="${open}">
            ${ico(open ? 'up' : 'down')}${open ? 'Fechar' : 'Aparelhos'}
          </button>
        </div>
      </div>
      ${open ? `<div class="mini-list">${g.customers.slice(0, 40).map(c => `
        <div class="mini-row">
          <div style="min-width:0">
            <div class="t mono">${esc(c.mac)}</div>
            <small class="muted">${esc(c.name || nameOf(c.reseller_id))} · vence ${fmtDate(c.expires_at)}</small>
          </div>
          ${pill(c)}
          <button class="btn sm" data-act="open-pl" data-id="${c.id}">${ico('edit')}Editar lista</button>
        </div>`).join('')}
        ${g.customers.length > 40 ? `<div class="muted sm" style="padding:10px 2px">+ ${g.customers.length - 40} aparelho(s). Use a busca para achar um deles.</div>` : ''}
      </div>` : ''}
    </section>`;
  }).join('') : `<div class="empty big">${ico('list')}<div><b>Nenhuma lista ${S.pq || S.pkind !== 'all' ? 'com esse filtro' : 'cadastrada ainda'}.</b>
    <div class="muted sm">A lista entra junto com a ativação do aparelho, ou pelo botão "Editar lista" na página Aparelhos.</div></div></div>`}`;
}

/* ---------- Ferramentas ---------- */
function toolsView() {
  const t = S.tools.t, d = S.tools.d;
  const alvo = t.from ? visibleCustomers().find(c => c.mac === normMac(t.from)) : null;
  const dHosts = [...new Set(playlistGroups().filter(g => g.pl.kind === 'xtream' || g.pl.kind === 'm3u').map(g => hostOf(plAddr(g.pl))).filter(Boolean))].sort();

  return `
  ${pageHead('Ferramentas', 'Operações em lote e mudanças de aparelho. Tudo passa pelo servidor, com registro no extrato.')}

  <div class="grid-2">
    <section class="card">
      <div class="card-head">
        <div><h2>${ico('swap')}Transferir ativação</h2>
        <div class="muted sm">O cliente trocou de aparelho (ou a TV queimou). Leva o plano e a lista para o MAC novo, sem cobrar crédito de novo.</div></div>
      </div>
      <div class="form-grid">
        <div class="f c6"><label for="t-from">MAC atual</label>
          <input class="in mono" id="t-from" data-tool="t.from" maxlength="17" placeholder="A4:5E:60:C8:1F:2B" value="${esc(t.from)}"></div>
        <div class="f c6"><label for="t-to">MAC novo</label>
          <input class="in mono" id="t-to" data-tool="t.to" maxlength="17" placeholder="B8:27:EB:11:22:33" value="${esc(t.to)}"></div>
        <div class="f c6"><label for="t-key">Device Key do aparelho novo</label>
          <input class="in mono" id="t-key" data-tool="t.key" maxlength="14" placeholder="7F3A-9C21-B4E8" value="${esc(t.key)}"></div>
        <div class="f c6"><label for="t-name">Nome do cliente (opcional)</label>
          <input class="in" id="t-name" data-tool="t.name" placeholder="Ex.: Dona Maria — sala" value="${esc(t.name)}"></div>

        <div class="preview c12">
          ${alvo ? `
            <div class="kv"><span>Plano que vai junto</span><b>vence ${fmtDate(alvo.expires_at)} · ${daysLeft(alvo) > 0 ? daysLeft(alvo) + ' dia(s)' : 'vencido'}</b></div>
            <div class="kv"><span>Lista</span><b>${alvo.playlist ? (alvo.playlist.kind === 'm3u' ? 'M3U · ' : 'Xtream · ') + esc(plTitle(alvo.playlist)) : 'nenhuma'}</b></div>
            <div class="kv"><span>Custo</span><b class="ok">0 crédito</b></div>`
          : `<div class="kv"><span>Plano que vai junto</span><b class="muted">digite o MAC atual</b></div>
             <div class="kv"><span>Custo</span><b class="ok">0 crédito</b></div>`}
        </div>

        ${t.err ? `<div class="banner err c12" role="alert">${ico('alert')}<div>${esc(t.err)}</div></div>` : ''}
        ${t.ok ? `<div class="banner ok c12"><span style="color:var(--ok)">${ico('check')}</span><div>
          <b>Ativação transferida.</b>
          <div class="muted sm">${esc(t.ok.de)} → ${esc(t.ok.para)} · vence ${fmtDate(Date.parse(t.ok.expires_at))}</div></div></div>` : ''}

        <div class="form-foot c12">
          <span class="muted sm">O MAC antigo é liberado e sai da sua lista de aparelhos ativos.</span>
          <button class="btn primary" data-act="do-transfer-dev" ${t.busy ? 'disabled' : ''}>
            ${t.busy ? spin : ico('swap')}${t.busy ? 'Transferindo…' : 'Transferir ativação'}
          </button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div><h2>${ico('globe')}Troca de domínio em massa</h2>
        <div class="muted sm">O fornecedor mudou o endereço do servidor. Troca em todas as listas de uma vez — com prévia antes de aplicar.</div></div>
      </div>
      <div class="form-grid">
        <div class="f c6"><label for="t-dfrom">Domínio antigo</label>
          <input class="in mono" id="t-dfrom" data-tool="d.from" placeholder="servidor-antigo.com" value="${esc(d.from)}" autocapitalize="off" spellcheck="false">
          ${dHosts.length ? `<div class="chips">${dHosts.slice(0, 6).map(h => `<button type="button" class="chip" data-act="dns-pick" data-host="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}</div>
        <div class="f c6"><label for="t-dto">Domínio novo</label>
          <input class="in mono" id="t-dto" data-tool="d.to" placeholder="servidor-novo.com:8080" value="${esc(d.to)}" autocapitalize="off" spellcheck="false">
          <span class="hint">Pode incluir a porta. Só a parte do endereço muda; usuário, senha e vencimento ficam iguais.</span></div>

        ${d.err ? `<div class="banner err c12" role="alert">${ico('alert')}<div>${esc(d.err)}</div></div>` : ''}

        ${d.preview ? `<div class="preview c12">
          <div class="kv"><span>Listas que serão alteradas</span><b class="num ${d.matched ? '' : 'bad'}">${d.matched}</b></div>
          ${d.matched ? d.preview.map(r => `<div class="dns-ex mono"><s>${esc(r.antes)}</s><span>${ico('send')}</span><b>${esc(r.depois)}</b></div>`).join('')
            : `<div class="muted sm">Nenhuma lista tem esse endereço — confira se digitou igual ao que está salvo (sem http:// e sem barra no fim).</div>`}
          ${d.matched > d.preview.length ? `<div class="muted sm">+ ${d.matched - d.preview.length} outras, iguais a essas.</div>` : ''}
        </div>` : ''}

        ${d.applied ? `<div class="banner ok c12"><span style="color:var(--ok)">${ico('check')}</span><div>
          <b>${d.applied} lista(s) atualizada(s).</b>
          <div class="muted sm">Os aparelhos pegam o endereço novo na próxima abertura do app.</div></div></div>` : ''}

        <div class="form-foot c12">
          <button class="btn" data-act="dns-preview" ${d.busy ? 'disabled' : ''}>${ico('search')}Ver o que muda</button>
          <button class="btn primary" data-act="dns-apply" ${d.busy || !d.matched ? 'disabled' : ''}>
            ${d.busy ? spin : ico('check')}${d.busy ? 'Aplicando…' : 'Aplicar a troca'}
          </button>
        </div>
      </div>
    </section>
  </div>`;
}

/* ---------- Como revender (diretriz) ---------- */
function diretrizView() {
  const adm = isAdm();
  return `
  ${pageHead('Como revender', 'O caminho inteiro, do crédito na carteira até a TV do cliente ligada.')}

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><h2>Passo a passo</h2></div>
      <ol class="steps">
        <li><b>Receba créditos.</b> ${adm ? 'Como Admin, você emite créditos na hora — eles nascem no extrato.' : 'Quem está acima de você transfere para a sua carteira. 1 crédito = 1 mês de 1 aparelho.'}</li>
        <li><b>Pegue o MAC e o Device Key.</b> Os dois aparecem na tela de ativação do app, no aparelho do cliente.</li>
        <li><b>Ative em <i>Aparelhos</i>.</b> Escolha o período, cole a lista (Xtream ou M3U) e confirme. O crédito sai na hora e o cliente já abre o app.</li>
        <li><b>Teste grátis.</b> Use <i>Cadastrar sem crédito</i> para liberar algumas horas antes de o cliente pagar.</li>
        <li><b>Renove antes de vencer.</b> O Painel mostra quem vence nos próximos 7 dias; o botão <i>Renovar</i> soma meses ao prazo que já existe.</li>
        <li><b>Trocou de aparelho?</b> <i>Ferramentas → Transferir ativação</i> leva o plano para o MAC novo sem gastar crédito.</li>
      </ol>
    </section>

    <section class="card">
      <div class="card-head"><h2>Regras que o servidor cobra</h2></div>
      <ul class="rules">
        <li>${ico('shield')}<div><b>Crédito nunca desaparece.</b> Cada ativação grava uma linha no extrato com o saldo depois da operação. O banco recusa apagar ou editar.</div></li>
        <li>${ico('shield')}<div><b>Aparelho tem um dono só.</b> Se o MAC já é de outro revendedor, a ativação é recusada — ninguém renova cliente alheio.</div></li>
        <li>${ico('shield')}<div><b>Device Key tem que bater.</b> MAC certo com key errada não ativa; é o que impede clonar aparelho.</div></li>
        <li>${ico('shield')}<div><b>Créditos só descem na árvore.</b> Você transfere para filhos diretos, nunca para o lado nem para cima.</div></li>
        <li>${ico('shield')}<div><b>Clicar duas vezes não cobra duas vezes.</b> Cada pedido leva um número único; repetir devolve o mesmo resultado.</div></li>
      </ul>
    </section>
  </div>

  <section class="card">
    <div class="card-head"><div><h2>Sua tabela de preços</h2>
      <div class="muted sm">Sugestão de quanto cobrar. Guardada só neste navegador — serve de cola na hora de vender.</div></div>
      <button class="btn sm ghost" data-act="price-reset">${ico('refresh')}Voltar ao padrão</button></div>
    <div class="price-grid">
      ${priceTable().filter(r => periodos().includes(r.m)).map(r => `
        <label class="price-row">
          <span class="m">${r.m} ${r.m === 1 ? 'mês' : 'meses'}</span>
          <span class="c">custa ${credTxt(custo(r.m))}</span>
          <span class="pw"><i>R$</i><input class="in num" data-price="${r.m}" inputmode="decimal" value="${esc(r.v)}"></span>
          <span class="muted sm">${r.v ? 'R$ ' + (Number(String(r.v).replace(',', '.')) / r.m).toFixed(2).replace('.', ',') + ' /mês' : '—'}</span>
        </label>`).join('')}
    </div>
  </section>`;
}

/* A tabela de preços é só do revendedor: fica no navegador dele, nunca no banco. */
const PRICE_KEY = 'ativa.prices';
const PRICE_DEF = { 1: '', 3: '', 6: '', 12: '' };
function priceStore() {
  try { return { ...PRICE_DEF, ...JSON.parse(localStorage.getItem(PRICE_KEY) || '{}') }; }
  catch { return { ...PRICE_DEF }; }
}
function priceTable() {
  const p = priceStore();
  return [1, 3, 6, 12].map(m => ({ m, v: p[m] || '' }));
}
function priceSet(m, v) {
  const p = priceStore(); p[m] = String(v).replace(/[^\d.,]/g, '');
  try { localStorage.setItem(PRICE_KEY, JSON.stringify(p)); } catch { /* navegador sem storage: segue sem salvar */ }
}

/* ---------- Ajustes ---------- */
function ajustesView() {
  const m = me(), a = S.acct;
  return `
  ${pageHead('Ajustes', 'Sua conta neste painel.')}

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><h2>Quem você é</h2></div>
      <div class="who">
        <span class="av lg">${esc(initials(m?.name))}</span>
        <div style="min-width:0">
          <b>${esc(m?.name || '—')}</b>
          <div class="muted sm">${esc(m?.email || S.session.user.email || '')}</div>
          <div class="chips" style="margin-top:8px">
            <span class="tag ${isAdm() ? 'xt' : ''}">${isAdm() ? 'Administrador' : 'Revendedor'}</span>
            <span class="tag">${isAdm() ? 'créditos ilimitados' : credTxt(myBalance())}</span>
            ${m?.parent ? `<span class="tag">acima: ${esc(nameOf(m.parent))}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="kv"><span>Aparelhos na sua árvore</span><b class="num">${visibleCustomers().length}</b></div>
      <div class="kv"><span>Revendedores abaixo</span><b class="num">${visibleResellers().length}</b></div>
      <div class="kv"><span>Dados atualizados</span><b>${S.loadedAt ? fmtDT(S.loadedAt) : '—'}</b></div>
      <div class="form-foot">
        <button class="btn ghost" data-act="reload">${ico('refresh')}Atualizar agora</button>
        <button class="btn ghost bad" data-act="logout">${ico('out')}Sair do painel</button>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div><h2>Trocar a senha</h2>
        <div class="muted sm">Vale para este painel. Mínimo de 8 caracteres.</div></div></div>
      <div class="form-grid">
        <div class="f c12"><label for="a-p1">Senha nova</label>
          <div class="pw"><input class="in mono" id="a-p1" data-acct="p1" type="${a.show ? 'text' : 'password'}" value="${esc(a.p1)}" autocomplete="new-password">
            <button type="button" class="link" data-act="acct-show">${a.show ? 'Ocultar' : 'Mostrar'}</button></div></div>
        <div class="f c12"><label for="a-p2">Repita a senha nova</label>
          <input class="in mono" id="a-p2" data-acct="p2" type="${a.show ? 'text' : 'password'}" value="${esc(a.p2)}" autocomplete="new-password"></div>
        ${a.err ? `<div class="banner err c12" role="alert">${ico('alert')}<div>${esc(a.err)}</div></div>` : ''}
        ${a.ok ? `<div class="banner ok c12"><span style="color:var(--ok)">${ico('check')}</span><div><b>Senha trocada.</b>
          <div class="muted sm">Use a senha nova na próxima vez que entrar.</div></div></div>` : ''}
        <div class="form-foot c12">
          <button class="btn primary" data-act="save-pass" ${a.busy ? 'disabled' : ''}>${a.busy ? spin : ico('lock')}${a.busy ? 'Salvando…' : 'Salvar senha'}</button>
        </div>
      </div>
    </section>
  </div>`;
}

/* ---------- Suporte ---------- */
function suporteView() {
  const m = me();
  const linha = (p, r) => `<details class="faq"><summary>${esc(p)}</summary><div>${r}</div></details>`;
  return `
  ${pageHead('Suporte', `Ativações, recarga de créditos e problemas: chame no WhatsApp ${SUPORTE_TXT}.`)}

  <section class="card wa-card">
    <div><h2>Suporte AtivaPlays no WhatsApp</h2>
      <div class="big num">${SUPORTE_TXT}</div>
      <div class="muted sm">Ativações, recarga de créditos e qualquer problema: tudo por esse número.</div></div>
    <div class="wa-acts">
      ${waBtn('Falar com o suporte', `Olá! Preciso de ajuda com o AtivaPlays. Conta: ${m?.email || ''}`, 'primary')}
      ${waBtn('Recarregar créditos', `Olá! Quero recarregar créditos no AtivaPlays. Conta: ${m?.email || ''}`)}
      ${waBtn('Problema numa ativação', `Olá! Tive um problema numa ativação no AtivaPlays. Conta: ${m?.email || ''}`)}
    </div>
  </section>

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><h2>Dúvidas que aparecem toda semana</h2></div>
      ${linha('O cliente ativou e o app abriu vazio.', 'O aparelho entrou, mas sem lista. Vá em <b>Listas</b> — o aviso amarelo mostra os aparelhos sem lista — e cadastre o endereço do painel (ou o link M3U).')}
      ${linha('Aparece "Este aparelho pertence a outro revendedor".', 'Esse MAC já foi ativado na árvore de outra pessoa. Só quem é dono renova. Se o cliente mudou de revendedor, quem tem o aparelho precisa liberar.')}
      ${linha('A Device Key não confere.', 'MAC e key vêm da mesma tela do aparelho. Se o cliente leu de um aparelho e a key de outro, não bate. Peça uma foto da tela de ativação.')}
      ${linha('Cliente trocou de TV.', '<b>Ferramentas → Transferir ativação.</b> Leva prazo e lista para o MAC novo e não cobra crédito.')}
      ${linha('O fornecedor mudou o endereço do servidor.', '<b>Ferramentas → Troca de domínio em massa.</b> Clique em <i>Ver o que muda</i> antes de aplicar: a prévia mostra cada lista que vai ser alterada.')}
      ${linha('Cliquei duas vezes em ativar. Cobrou dobrado?', 'Não. Cada pedido vai com um número único; o segundo clique devolve o mesmo resultado sem tocar na carteira.')}
      ${linha('Quero dar uns dias de teste.', 'Na página <b>Aparelhos</b>, botão <i>Cadastrar sem crédito (teste)</i>. O aparelho fica com a marca "teste" e vence sozinho.')}
    </section>

    <section class="card">
      <div class="card-head"><h2>Quem te passa créditos</h2></div>
      ${m?.parent ? `
        <div class="who">
          <span class="av lg">${esc(initials(nameOf(m.parent)))}</span>
          <div><b>${esc(nameOf(m.parent))}</b><div class="muted sm">quem te passa créditos</div>
          <div class="muted sm mono">${esc(profile(m.parent)?.email || '')}</div></div>
        </div>`
      : `<div class="empty">${ico('users')}<div>Você está no topo da árvore. O suporte é o WhatsApp acima.</div></div>`}

      <div class="card-head" style="margin-top:18px"><h2>Dados para mandar junto</h2></div>
      <div class="muted sm">Copie e cole no recado: economiza umas cinco mensagens de ida e volta.</div>
      <pre class="codeblock mono" id="sup-dump">${esc([
        `Painel: AtivaPlays`,
        `Conta: ${m?.name || '—'} (${m?.email || ''})`,
        `Perfil: ${isAdm() ? 'admin' : 'revendedor'}`,
        `Saldo: ${isAdm() ? 'ilimitado' : fmtC(myBalance())}`,
        `Aparelhos: ${visibleCustomers().length}`,
        `Navegador: ${navigator.userAgent}`
      ].join('\n'))}</pre>
      <div class="row-acts"><button class="btn sm" data-act="copy-sup">${ico('copy')}Copiar dados</button>
      <button class="btn sm wa" data-act="wa-sup">${ico('chat')}Enviar no WhatsApp</button></div>
    </section>
  </div>`;
}

/* =====================================================================
   MODAIS
   ===================================================================== */
const modalShell = inner => `<div class="overlay" data-act="overlay"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
const mBtn = (label, iconName) => S.mf.busy ? `${spin}Aguarde…` : `${ico(iconName)}${label}`;

/* Campos da lista dentro de um modal (usam data-mf, não data-field). */
function plFieldsModal(f) {
  return `
  <div class="seg wide" role="group" aria-label="Tipo de lista">
    <button type="button" class="seg-b ${f.kind === 'xtream' ? 'on' : ''}" data-act="pl-kind" data-kind="xtream" data-where="m">Painel (Xtream)</button>
    <button type="button" class="seg-b ${f.kind === 'm3u' ? 'on' : ''}" data-act="pl-kind" data-kind="m3u" data-where="m">Link M3U</button>
  </div>
  ${f.kind === 'm3u' ? `
    <div class="f"><label for="m-m3u">Link da lista (.m3u / .m3u8)</label>
      <input class="in mono" id="m-m3u" data-mf="m3u" value="${esc(f.m3u)}" placeholder="http://servidor.com/get.php?username=joao&password=1234&type=m3u_plus" autocapitalize="off" spellcheck="false">
      <span class="hint">Cole o link inteiro. O app baixa a lista direto desse endereço.</span></div>
  ` : `
    <div class="f"><label for="m-url">Endereço do painel</label>
      <input class="in mono" id="m-url" data-mf="url" value="${esc(f.url)}" placeholder="http://servidor.com:8080" autocapitalize="off" spellcheck="false">
      <span class="hint">Sem /player_api.php e sem barra no fim.</span></div>
    <div class="f"><label for="m-user">Usuário</label>
      <input class="in mono" id="m-user" data-mf="user" value="${esc(f.user)}" autocapitalize="off" spellcheck="false"></div>
    <div class="f"><label for="m-pass">Senha</label>
      <div class="pw"><input class="in mono" id="m-pass" data-mf="pass" type="${f.show ? 'text' : 'password'}" value="${esc(f.pass)}" style="padding-right:78px" autocapitalize="off" spellcheck="false">
      <button type="button" class="link" data-act="mf-toggle">${f.show ? 'Ocultar' : 'Mostrar'}</button></div></div>
  `}`;
}

function modalHTML() {
  const m = S.modal; if (!m) return '';
  const f = S.mf, dis = f.busy ? 'disabled' : '';

  if (m.type === 'playlist') {
    const c = S.data.customers.find(x => x.id === m.id);
    if (!c) return '';
    return modalShell(`<h2>${c.playlist ? 'Trocar a lista' : 'Cadastrar a lista'}</h2>
      <p class="sub mono">${esc(c.mac)}${c.name ? ' · ' + esc(c.name) : ''}</p>
      <div class="stack">
        ${plFieldsModal(f)}
        ${f.err ? `<div class="banner err" role="alert">${ico('alert')}<div>${esc(f.err)}</div></div>` : ''}
        <div class="muted sm">O aparelho pega a lista nova na próxima vez que o app abrir. Não gasta crédito.</div>
      </div>
      <div class="modal-actions"><button class="btn ghost" data-act="close" ${dis}>Cancelar</button>
        <button class="btn primary" data-act="save-pl" ${dis}>${mBtn('Salvar lista', 'check')}</button></div>`);
  }

  if (m.type === 'trial') {
    return modalShell(`<h2>Cadastrar sem crédito</h2>
      <p class="sub">Libera algumas horas de teste. Não mexe na sua carteira e não entra no extrato, porque crédito nenhum se move.</p>
      <div class="stack">
        <div class="f"><label for="m-tmac">Endereço MAC</label>
          <input class="in mono" id="m-tmac" data-mf="mac" maxlength="17" value="${esc(f.mac)}" placeholder="A4:5E:60:C8:1F:2B"></div>
        <div class="f"><label for="m-tkey">Device Key</label>
          <input class="in mono" id="m-tkey" data-mf="key" maxlength="14" value="${esc(f.key)}" placeholder="7F3A-9C21-B4E8"></div>
        <div class="f"><label for="m-tname">Nome do cliente (opcional)</label>
          <input class="in" id="m-tname" data-mf="name" value="${esc(f.name)}" placeholder="Ex.: Seu João — teste"></div>
        <div class="f"><label for="m-thours">Duração do teste</label>
          <select class="in" id="m-thours" data-mf="hours">
            ${[3, 6, 12, 24, 48, 72, 168].map(h => `<option value="${h}" ${+f.hours === h ? 'selected' : ''}>${h < 24 ? h + ' horas' : (h / 24) + (h === 24 ? ' dia' : ' dias')}</option>`).join('')}
          </select>
          <span class="hint">Vence sozinho. Para virar cliente pago, é só ativar normalmente depois — os meses somam a partir dali.</span></div>
        ${f.err ? `<div class="banner err" role="alert">${ico('alert')}<div>${esc(f.err)}</div></div>` : ''}
      </div>
      <div class="modal-actions"><button class="btn ghost" data-act="close" ${dis}>Cancelar</button>
        <button class="btn primary" data-act="save-trial" ${dis}>${mBtn('Liberar teste', 'trial')}</button></div>`);
  }

  if (m.type === 'newsub') {
    return modalShell(`<h2>Novo revendedor</h2>
      <p class="sub">Cria o login e o perfil como seu filho direto. Passe o e-mail e a senha para ele entrar neste mesmo painel.</p>
      <div class="stack">
        <div class="f"><label for="m-name">Nome</label><input class="in" id="m-name" data-mf="name" value="${esc(f.name)}" placeholder="Ex.: Marcos Oliveira"></div>
        <div class="f"><label for="m-email">E-mail de acesso</label><input class="in" id="m-email" data-mf="email" type="email" value="${esc(f.email)}" placeholder="marcos@exemplo.com" autocapitalize="off"></div>
        <div class="f"><label for="m-password">Senha inicial (mín. 8 caracteres)</label>
          <div class="pw"><input class="in mono" id="m-password" data-mf="password" value="${esc(f.password)}" autocomplete="off" style="padding-right:78px">
            <button type="button" class="link" data-act="gen-pass">Gerar</button></div></div>
        <div class="f"><label for="m-credits">Créditos iniciais (opcional)</label>
          <input class="in num" id="m-credits" data-mf="credits" inputmode="numeric" value="${esc(f.credits)}" placeholder="0">
          <span class="hint">${isAdm() ? 'Emitidos por você (Admin).' : `Saem da sua carteira (saldo: ${fmtC(myBalance())}).`}</span></div>
        ${f.err ? `<div class="banner err" role="alert">${ico('alert')}<div>${esc(f.err)}</div></div>` : ''}
      </div>
      <div class="modal-actions"><button class="btn ghost" data-act="close" ${dis}>Cancelar</button>
        <button class="btn primary" data-act="save-newsub" ${dis}>${mBtn('Criar revendedor', 'plus')}</button></div>`);
  }

  if (m.type === 'transfer') {
    const adm = isAdm();
    const targets = adm ? S.data.profiles.filter(p => p.role === 'reseller' && p.active) : S.data.profiles.filter(p => p.parent === me().id && p.active);
    const amt = parseNum(f.amount), tgt = profile(f.target);
    const after = r2(myBalance() - amt);
    return modalShell(`<h2>${adm ? 'Emitir créditos' : 'Transferir créditos'}</h2>
      <p class="sub">${adm ? 'O Admin cria créditos novos na carteira do revendedor.' : 'Debita da sua carteira e soma na carteira do seu revendedor.'}</p>
      <div class="stack">
        <div class="f"><label for="m-target">${adm ? 'Revendedor' : 'Revendedor (filho direto)'}</label>
          <select class="in" id="m-target" data-mf="target">${targets.map(p => `<option value="${p.id}" ${f.target === p.id ? 'selected' : ''}>${esc(p.name)} — saldo ${fmtC(S.data.wallets[p.id] ?? 0)}</option>`).join('')}</select></div>
        <div class="f"><label for="m-amount">Quantidade de créditos</label>
          <input class="in num" id="m-amount" data-mf="amount" inputmode="decimal" value="${esc(f.amount)}" placeholder="Ex.: 10 ou 0,5">
          <span class="hint">Aceita meio crédito (0,5). 1 crédito = 12 meses · 0,5 = 6 meses.</span>
          <div class="chips">${[0.5, 1, 5, 10, 25].map(n => `<button type="button" class="chip" data-act="mf-amount" data-n="${n}">${n}</button>`).join('')}</div></div>
        <div class="preview" id="m-preview" style="grid-column:auto">${transferPreview(adm, after, tgt, amt)}</div>
        ${f.err ? `<div class="banner err" role="alert">${ico('alert')}<div>${esc(f.err)}</div></div>` : ''}
      </div>
      <div class="modal-actions"><button class="btn ghost" data-act="close" ${dis}>Cancelar</button>
        <button class="btn primary" data-act="save-transfer" ${dis}>${mBtn(adm ? 'Emitir' : 'Transferir', adm ? 'coin' : 'send')}</button></div>`);
  }
  return '';
}

function transferPreview(adm, after, tgt, amt) {
  return `<div class="kv"><span>Seu saldo após</span><b class="num ${!adm && after < 0 ? 'bad' : ''}">${adm ? '∞' : fmtC(after)}</b></div>
          <div class="kv"><span>Saldo de ${esc(tgt?.name.split(' ')[0] || '—')} após</span><b class="num">${tgt ? fmtC(Number(S.data.wallets[tgt.id] ?? 0) + amt) : '—'}</b></div>`;
}

/* =====================================================================
   RENDER
   ===================================================================== */
function viewFor(route) {
  switch (route) {
    case 'painel': return dashboard();
    case 'diretriz': return diretrizView();
    case 'dispositivos': return devicesView();
    case 'revendedores': return resellersView();
    case 'creditos': return creditsView();
    case 'playlists': return playlistsView();
    case 'ferramentas': return toolsView();
    case 'ajustes': return ajustesView();
    case 'suporte': return suporteView();
    default: return dashboard();
  }
}

function render() {
  const app = document.getElementById('app');
  if (!CONFIGURED) { app.innerHTML = configHelp(); return; }
  if (S.booting) { app.innerHTML = `<div class="boot">${spin}<span>Conectando…</span></div>`; return; }
  if (!S.session) { app.innerHTML = loginView(); document.getElementById('l-email')?.focus(); return; }
  if (S.noProfile) { app.innerHTML = noProfileView(); return; }
  /* Primeira carga: a sessão já existe, mas os perfis ainda estão vindo.
     Sem esta guarda a moldura tentaria desenhar o nome de um usuário que
     ainda não chegou — e a tela inteira ficaria em branco. */
  if (!me()) { app.innerHTML = `<div class="boot">${spin}<span>Carregando seus dados…</span></div>`; return; }

  const focus = document.activeElement;
  const keep = focus && focus.id && /^(f|m|l|a|t|pl|r)-/.test(focus.id)
    ? { id: focus.id, start: focus.selectionStart, end: focus.selectionEnd } : null;

  app.innerHTML = shell(viewFor(S.route)) + modalHTML();
  document.body.classList.toggle('modal-open', !!S.modal);

  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) {
      el.focus();
      try { el.setSelectionRange(keep.start, keep.end); } catch { /* select não aceita seleção */ }
    }
  }
}

function toast(kind, text) {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = `${ico(kind === 'ok' ? 'check' : 'alert')}<span>${esc(text)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 4200);
}

/* =====================================================================
   AÇÕES
   ===================================================================== */
const URL_MSG = 'Endereço inválido. Use http:// ou https:// (ex.: http://servidor.com:8080).';
const M3U_MSG = 'Link da lista inválido. Cole o endereço inteiro, começando com http:// ou https://.';

/* Roda uma ação do servidor: trava duplo clique, mostra erro, recarrega os dados. */
async function guarded(fn, { reload = true } = {}) {
  if (S.busy) return;
  S.busy = true; render();
  try { await fn(); if (reload) await loadAll(); }
  catch (e) { toast('err', e.message || 'Algo deu errado.'); if (!(e instanceof AppError)) console.error(e); }
  finally { S.busy = false; render(); }
}

/* Valida o formulário e monta o corpo que a Edge Function espera. */
function activationBody(form, requestId) {
  const m3u = String(form.m3u || '').trim();
  const url = String(form.url || '').trim();
  const user = String(form.user || '').trim();
  const kind = form.kind === 'm3u' ? 'm3u' : 'xtream';
  const hasPl = kind === 'm3u' ? m3u !== '' : (url !== '' || user !== '' || String(form.pass) !== '');

  if (!MAC_RE.test(normMac(form.mac))) throw new AppError('Endereço MAC inválido. Use o formato A4:5E:60:C8:1F:2B.', 'INVALID_INPUT');
  if (!/^[0-9a-f]{12}$/.test(normKey(form.key))) throw new AppError('Device Key inválida. São 12 caracteres (ex.: 7F3A-9C21-B4E8).', 'INVALID_INPUT');

  if (hasPl && kind === 'm3u' && !URL_RE.test(m3u)) throw new AppError(M3U_MSG, 'INVALID_INPUT');
  if (hasPl && kind === 'xtream') {
    if (!(url && user && form.pass)) throw new AppError('Lista incompleta: preencha endereço, usuário e senha — ou deixe os três vazios.', 'INVALID_INPUT');
    if (!URL_RE.test(url)) throw new AppError(URL_MSG, 'INVALID_INPUT');
  }

  const body = { mac_address: normMac(form.mac), device_key: normKey(form.key), meses_ativacao: +form.months, request_id: requestId };
  if (hasPl) {
    body.playlist = kind === 'm3u'
      ? { kind: 'm3u', m3u_url: m3u }
      : { kind: 'xtream', server_url: url, username: user, password: form.pass };
  }
  return body;
}

/* Vai para uma página do menu (e, se pedido, põe o foco num campo de lá). */
function goPage(id, focus) {
  S.route = id; S.nav = false; render();
  window.scrollTo({ top: 0 });
  if (focus) { const el = document.getElementById(focus); if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); } }
}

const ACTIONS = {
  go(el) { goPage(el.dataset.page, el.dataset.focus); },
  'nav-open'() { S.nav = true; render(); },
  'nav-close'() { S.nav = false; render(); },
  'goto-filter'(el) { S.cfilter = el.dataset.filter; S.cLimit = 100; goPage('dispositivos'); document.getElementById('c-list-anchor')?.scrollIntoView({ block: 'start' }); },
  cfilter(el) { S.cfilter = el.dataset.f; S.cLimit = 100; render(); },
  lfilter(el) { S.lfilter = el.dataset.f; S.lLimit = 200; render(); },
  pkind(el) { S.pkind = el.dataset.kind; render(); },
  'clear-q'() { S.q = ''; S.cLimit = 60; render(); document.getElementById('f-q')?.focus(); },
  'clear-pq'() { S.pq = ''; render(); document.getElementById('pl-q')?.focus(); },
  'more-customers'() { S.cLimit += 100; render(); },
  'more-ledger'() { S.lLimit += 200; render(); },
  months(el) { S.form.months = +el.dataset.n; S.reqId = uuid(); render(); },
  'toggle-pass'() { S.form.showPass = !S.form.showPass; render(); },
  'clear-form'() { Object.assign(S.form, { ...FORM0, kind: S.form.kind }); S.error = null; S.result = null; S.reqId = uuid(); render(); },
  refresh() { return loadAll(); },
  reload() { return loadAll(); },
  async logout() { await sb.auth.signOut(); },

  /* Xtream <-> M3U: o mesmo botão serve para o formulário ('f') e para o modal ('m'). */
  'pl-kind'(el) {
    const kind = el.dataset.kind === 'm3u' ? 'm3u' : 'xtream';
    if (el.dataset.where === 'm') { S.mf.kind = kind; S.mf.err = ''; }
    else { S.form.kind = kind; S.form.plSel = ''; S.reqId = uuid(); }
    render();
  },

  renew(el) {
    const c = S.data.customers.find(x => x.id === el.dataset.id);
    return guarded(async () => {
      const r = await callFn('ativar_cliente', { mac_address: c.mac, device_key: c.key, meses_ativacao: isAdm() ? 1 : 6, request_id: uuid() });
      S.flashId = c.id;
      toast('ok', `${c.mac} renovado até ${fmtDate(Date.parse(r.expires_at))}.${isAdm() ? '' : ' Saldo: ' + fmtC(r.balance_after) + '.'}`);
    });
  },
  block(el) {
    const c = S.data.customers.find(x => x.id === el.dataset.id), to = c.status !== 'blocked';
    return guarded(async () => {
      await rpc('set_customer_blocked', { p_mac: c.mac, p_blocked: to });
      S.flashId = c.id;
      toast('ok', `${c.mac} ${to ? 'bloqueado: o app volta para a tela de ativação' : 'desbloqueado'}.`);
    });
  },

  /* ----- lista de um aparelho ----- */
  'open-pl'(el) {
    const c = S.data.customers.find(x => x.id === el.dataset.id); if (!c) return;
    const p = c.playlist || {};
    S.modal = { type: 'playlist', id: c.id };
    S.mf = { kind: p.kind || 'xtream', url: p.url || '', user: p.user || '', pass: p.pass || '', m3u: p.m3u || '', show: false, err: '', busy: false };
    render();
    document.getElementById(S.mf.kind === 'm3u' ? 'm-m3u' : 'm-url')?.focus();
  },
  'edit-pl'(el) { return ACTIONS['open-pl'](el); },
  'mf-toggle'() { S.mf.show = !S.mf.show; render(); },
  async 'save-pl'() {
    if (S.mf.busy) return;
    const c = S.data.customers.find(x => x.id === S.modal.id); if (!c) return;
    const f = S.mf, m3u = String(f.m3u || '').trim(), url = String(f.url || '').trim(), user = String(f.user || '').trim();
    if (f.kind === 'm3u') {
      if (!URL_RE.test(m3u)) { f.err = M3U_MSG; return render(); }
    } else {
      if (!URL_RE.test(url)) { f.err = URL_MSG; return render(); }
      if (!user || !f.pass) { f.err = 'Informe usuário e senha da lista.'; return render(); }
    }
    f.busy = true; f.err = ''; render();
    try {
      await rpc('upsert_customer_playlist', f.kind === 'm3u'
        ? { p_mac: c.mac, p_server_url: null, p_username: null, p_password: null, p_kind: 'm3u', p_m3u_url: m3u }
        : { p_mac: c.mac, p_server_url: url, p_username: user, p_password: f.pass, p_kind: 'xtream', p_m3u_url: null });
      S.flashId = c.id; S.modal = null;
      toast('ok', 'Lista salva. O aparelho pega a nova na próxima abertura do app.');
      await loadAll();
    } catch (e) { f.err = e.message; f.busy = false; render(); }
  },
  'copy-pl'(el) {
    const g = playlistGroups().find(x => x.key === el.dataset.key); if (!g) return;
    const txt = plAddr(g.pl);
    (navigator.clipboard?.writeText(txt) || Promise.reject()).then(
      () => toast('ok', 'Endereço copiado.'),
      () => toast('err', 'Não foi possível copiar neste navegador.'));
  },
  'pl-open'(el) { S.plOpen = S.plOpen === el.dataset.key ? null : el.dataset.key; render(); },
  'pl-dns'(el) { S.tools.d.from = el.dataset.host || ''; S.tools.d.preview = null; S.tools.d.matched = 0; S.tools.d.applied = null; goPage('ferramentas', 't-dto'); },

  /* ----- teste sem crédito ----- */
  'open-trial'() {
    S.modal = { type: 'trial' };
    S.mf = { mac: S.form.mac || '', key: S.form.key || '', name: '', hours: 24, err: '', busy: false };
    render(); document.getElementById('m-tmac')?.focus();
  },
  async 'save-trial'() {
    if (S.mf.busy) return;
    const f = S.mf;
    if (!MAC_RE.test(normMac(f.mac))) { f.err = 'Endereço MAC inválido. Use o formato A4:5E:60:C8:1F:2B.'; return render(); }
    if (!/^[0-9a-f]{12}$/.test(normKey(f.key))) { f.err = 'Device Key inválida. São 12 caracteres.'; return render(); }
    f.busy = true; f.err = ''; render();
    try {
      const r = await rpc('registrar_aparelho', { p_mac: normMac(f.mac), p_device_key: normKey(f.key), p_name: String(f.name).trim() || null, p_trial_hours: +f.hours });
      S.flashId = r.customer_id; S.modal = null;
      toast('ok', `Teste liberado até ${fmtDT(Date.parse(r.expires_at))}. Nenhum crédito foi cobrado.`);
      await loadAll();
    } catch (e) { f.err = e.message; f.busy = false; render(); }
  },

  /* ----- revendedores e créditos ----- */
  'open-newsub'() { S.modal = { type: 'newsub' }; S.mf = { name: '', email: '', password: '', credits: '', err: '', busy: false }; render(); document.getElementById('m-name')?.focus(); },
  'gen-pass'() { S.mf.password = genPassword(); render(); },
  async 'save-newsub'() {
    if (S.mf.busy) return;
    const f = S.mf, credits = String(f.credits).trim() === '' ? 0 : Number(f.credits);
    if (String(f.name).trim().length < 2) { f.err = 'Informe o nome do revendedor.'; return render(); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.email).trim())) { f.err = 'E-mail inválido.'; return render(); }
    if (String(f.password).length < 8) { f.err = 'A senha precisa ter pelo menos 8 caracteres.'; return render(); }
    if (!Number.isInteger(credits) || credits < 0) { f.err = 'Créditos iniciais devem ser um número inteiro (ou vazio).'; return render(); }
    if (!isAdm() && credits > myBalance()) { f.err = `Saldo insuficiente: você tem ${credTxt(myBalance())}.`; return render(); }
    f.busy = true; f.err = ''; render();
    try {
      const r = await callFn('criar_revendedor', { email: String(f.email).trim(), password: f.password, name: String(f.name).trim(), creditos_iniciais: credits });
      S.modal = null; toast('ok', `${r.name} criado${credits ? ' com ' + credits + ' créditos' : ''}. Login: ${r.email}`);
      await loadAll();
    } catch (e) { f.err = e.message; f.busy = false; render(); }
  },
  'open-transfer'(el) {
    const adm = isAdm();
    const list = adm ? S.data.profiles.filter(p => p.role === 'reseller' && p.active) : S.data.profiles.filter(p => p.parent === me().id && p.active);
    if (!list.length) return toast('err', 'Crie um revendedor antes de transferir créditos.');
    S.modal = { type: 'transfer' }; S.mf = { target: el?.dataset?.target || list[0].id, amount: '', err: '', busy: false };
    render(); document.getElementById('m-amount')?.focus();
  },
  'mf-amount'(el) { S.mf.amount = el.dataset.n; render(); },
  async 'save-transfer'() {
    if (S.mf.busy) return;
    const amt = parseNum(S.mf.amount), to = S.mf.target;
    if (!(amt > 0) || Math.abs(amt * 100 - Math.round(amt * 100)) > 1e-9) { S.mf.err = 'Informe uma quantidade de créditos maior que zero.'; return render(); }
    if (!isAdm() && amt > myBalance()) { S.mf.err = `Saldo insuficiente: você tem ${credTxt(myBalance())} e quer repassar ${fmtC(amt)}.`; return render(); }
    S.mf.busy = true; S.mf.err = ''; render();
    try {
      if (isAdm()) await rpc('admin_grant_credits', { p_target: to, p_amount: amt, p_note: `Emissão para ${nameOf(to)}` });
      else await rpc('transfer_credits', { p_child: to, p_amount: amt });
      S.modal = null; toast('ok', `${credTxt(amt)} ${isAdm() ? 'emitidos para' : 'transferidos para'} ${nameOf(to)}.`);
      await loadAll();
    } catch (e) { S.mf.err = e.message; S.mf.busy = false; render(); }
  },

  /* ----- ferramentas: transferir ativação ----- */
  'open-move'(el) {
    const c = S.data.customers.find(x => x.id === el.dataset.id);
    S.tools.t = { from: c ? c.mac : '', to: '', key: '', name: c?.name || '', busy: false, err: '', ok: null };
    goPage('ferramentas', 't-to');
  },
  async 'do-transfer-dev'() {
    const t = S.tools.t; if (t.busy) return;
    if (!MAC_RE.test(normMac(t.from))) { t.err = 'MAC atual inválido. Use o formato A4:5E:60:C8:1F:2B.'; return render(); }
    if (!MAC_RE.test(normMac(t.to))) { t.err = 'MAC novo inválido. Use o formato A4:5E:60:C8:1F:2B.'; return render(); }
    if (normMac(t.from) === normMac(t.to)) { t.err = 'Os dois MACs são o mesmo aparelho.'; return render(); }
    if (!/^[0-9a-f]{12}$/.test(normKey(t.key))) { t.err = 'Device Key do aparelho novo inválida. São 12 caracteres.'; return render(); }
    t.busy = true; t.err = ''; t.ok = null; render();
    try {
      const r = await rpc('transferir_ativacao', { p_from_mac: normMac(t.from), p_to_mac: normMac(t.to), p_to_key: normKey(t.key), p_name: String(t.name).trim() || null });
      t.ok = { de: r.from_mac || normMac(t.from), para: r.to_mac || normMac(t.to), expires_at: r.expires_at };
      t.from = ''; t.to = ''; t.key = ''; t.name = '';
      toast('ok', 'Ativação transferida para o aparelho novo. Nenhum crédito foi cobrado.');
      await loadAll();
    } catch (e) { t.err = e.message; }
    t.busy = false; render();
  },

  /* ----- ferramentas: troca de domínio em massa ----- */
  'dns-pick'(el) { S.tools.d.from = el.dataset.host || ''; S.tools.d.preview = null; S.tools.d.matched = 0; render(); document.getElementById('t-dto')?.focus(); },
  'dns-preview'() { return dnsRun(false); },
  'dns-apply'() { return dnsRun(true); },

  /* ----- ajustes ----- */
  'acct-show'() { S.acct.show = !S.acct.show; render(); },
  async 'save-pass'() {
    const a = S.acct; if (a.busy) return;
    if (String(a.p1).length < 8) { a.err = 'A senha precisa ter pelo menos 8 caracteres.'; a.ok = false; return render(); }
    if (a.p1 !== a.p2) { a.err = 'As duas senhas não são iguais.'; a.ok = false; return render(); }
    a.busy = true; a.err = ''; a.ok = false; render();
    const { error } = await sb.auth.updateUser({ password: a.p1 });
    a.busy = false;
    if (error) { a.err = error.message || 'Não foi possível trocar a senha.'; return render(); }
    a.p1 = ''; a.p2 = ''; a.ok = true; render();
    toast('ok', 'Senha trocada.');
  },

  /* ----- diretriz: tabela de preços (só neste navegador) ----- */
  'price-reset'() {
    try { localStorage.removeItem(PRICE_KEY); } catch { /* sem storage: nada a limpar */ }
    render(); toast('ok', 'Tabela de preços limpa.');
  },

  /* ----- suporte ----- */
  'wa-sup'() {
    const txt = document.getElementById('sup-dump')?.textContent || '';
    window.open(waLink('Olá! Preciso de ajuda com o AtivaPlays.\n\n' + txt), '_blank', 'noopener');
  },
  'copy-sup'() {
    const txt = document.getElementById('sup-dump')?.textContent || '';
    (navigator.clipboard?.writeText(txt) || Promise.reject()).then(
      () => toast('ok', 'Dados copiados. Cole no recado para o suporte.'),
      () => toast('err', 'Não foi possível copiar neste navegador.'));
  },

  close() { if (S.mf.busy) return; S.modal = null; render(); },
  overlay(el, ev) { if (ev.target === el) ACTIONS.close(); },
  replay() {
    if (!S.result) return;
    return guarded(async () => {
      try {
        const res = await callFn('ativar_cliente', activationBody(S.result.form, S.result.reqId));
        S.result = { ...S.result, res }; S.error = null; toast('ok', 'Mesmo pedido: nada foi cobrado de novo.');
      } catch (e) { S.error = e; throw e; }
    });
  },
  'copy-csv'() {
    const rows = [['id', 'data', 'tipo', 'carteira', 'descricao', 'delta', 'saldo_apos'],
      ...visibleLedger().map(l => [l.id, new Date(l.at).toISOString(), l.reason, nameOf(l.owner), descOf(l), l.delta, l.balance_after])];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    (navigator.clipboard?.writeText(csv) || Promise.reject()).then(
      () => toast('ok', 'Extrato copiado como CSV.'),
      () => toast('err', 'Não foi possível copiar neste navegador.'));
  }
};

/* A prévia e a aplicação chamam a MESMA função do banco; só muda p_apply.
   Assim o que você vê na prévia é exatamente o que vai ser alterado. */
async function dnsRun(apply) {
  const d = S.tools.d; if (d.busy) return;
  const from = String(d.from).trim(), to = String(d.to).trim();
  if (from.length < 6) { d.err = 'O endereço antigo precisa ter pelo menos 6 caracteres.'; d.preview = null; return render(); }
  if (to.length < 4 || /\s/.test(to)) { d.err = 'Informe o endereço novo, sem espaços.'; d.preview = null; return render(); }
  if (from === to) { d.err = 'Os dois endereços são iguais.'; d.preview = null; return render(); }
  d.busy = true; d.err = ''; if (apply) d.applied = null; render();
  try {
    const r = await rpc('trocar_dominio_em_massa', { p_from: from, p_to: to, p_apply: apply });
    d.matched = r.matched || 0;
    d.preview = r.examples || [];
    if (apply) {
      d.applied = r.applied ? d.matched : 0;
      if (r.applied) { d.preview = null; d.matched = 0; toast('ok', `${d.applied} lista(s) atualizada(s).`); }
      else toast('err', 'Nenhuma lista casou com esse endereço.');
      await loadAll();
    }
  } catch (e) { d.err = e.message; d.preview = null; d.matched = 0; }
  d.busy = false; render();
}

/* ---------- Cliques ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) Promise.resolve(fn(el, ev)).catch(e => { console.error(e); toast('err', 'Algo deu errado. Tente de novo.'); });
});

/* ---------- Formulários ---------- */
document.addEventListener('submit', async ev => {
  const id = ev.target.id;
  if (id === 'login-form') {
    ev.preventDefault();
    const l = S.login; if (l.busy) return;
    if (!l.email.trim() || !l.pass) { l.err = 'Informe e-mail e senha.'; return render(); }
    l.busy = true; l.err = ''; render();
    const { data, error } = await sb.auth.signInWithPassword({ email: l.email.trim(), password: l.pass });
    l.busy = false;
    if (error || !data.session) {
      l.err = /invalid|credentials/i.test(error?.message || '') ? 'E-mail ou senha incorretos.' : (error?.message || 'Não foi possível entrar.');
      l.pass = ''; return render();
    }
    l.pass = ''; S.session = data.session; S.route = 'painel'; await loadAll();
    return;
  }
  if (id !== 'act-form') return;
  ev.preventDefault();
  if (S.busy) return;
  const form = { ...S.form }, reqId = S.reqId;
  S.busy = true; S.error = null; render();
  try {
    const res = await callFn('ativar_cliente', activationBody(form, reqId));
    S.result = { res, form, reqId }; S.flashId = res.customer_id; S.reqId = uuid();
    Object.assign(S.form, { mac: '', key: '' });
    toast('ok', `${res.mac_address} ${res.created ? 'ativado' : 'renovado'} até ${fmtDate(Date.parse(res.expires_at))}.${isAdm() ? '' : ' Saldo: ' + credTxt(res.balance_after) + '.'}`);
    await loadAll();
  } catch (e) {
    S.error = e instanceof AppError ? e : new AppError('Erro inesperado. Tente de novo.', 'ERROR');
    S.result = null; if (!(e instanceof AppError)) console.error(e);
  }
  S.busy = false; render();
  document.getElementById('c-' + S.flashId)?.scrollIntoView({ block: 'nearest' });
});

/* ---------- Digitação: atualiza o estado sem redesenhar (não perde o foco) ---------- */
function refreshPreview() {
  const p = document.getElementById('act-preview'); if (p) p.innerHTML = planPreview();
  const l = document.getElementById('act-label');
  if (l && !S.busy) l.textContent = (MAC_RE.test(normMac(S.form.mac)) && S.data.customers.some(c => c.mac === normMac(S.form.mac))) ? 'Renovar cliente' : 'Ativar cliente';
}
const maskMac = v => v.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 12).replace(/(.{2})(?=.)/g, '$1:');
const maskKey = v => v.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 12).replace(/(.{4})(?=.)/g, '$1-');

document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.login) { S.login[t.dataset.login] = t.value; return; }

  if (t.dataset.field) {
    const k = t.dataset.field;
    if (k === 'q') { S.q = t.value; S.cLimit = 100; render(); return; }
    S.reqId = uuid(); // pedido diferente => request_id novo
    if (k === 'mac') { t.value = maskMac(t.value); S.form.mac = t.value; }
    else if (k === 'key') { t.value = maskKey(t.value); S.form.key = t.value; }
    else {
      S.form[k] = t.value;
      if (['url', 'user', 'pass', 'm3u'].includes(k) && S.form.plSel) {
        S.form.plSel = ''; const s = document.getElementById('f-plsel'); if (s) s.value = '';
      }
    }
    refreshPreview();
    return;
  }

  if (t.dataset.mf) {
    const k = t.dataset.mf;
    if (k === 'mac') t.value = maskMac(t.value);
    if (k === 'key') t.value = maskKey(t.value);
    S.mf[k] = t.value;
    if (S.modal?.type === 'transfer' && k === 'amount') {
      const adm = isAdm(), amt = parseNum(S.mf.amount), p = document.getElementById('m-preview');
      if (p) p.innerHTML = transferPreview(adm, r2(myBalance() - amt), profile(S.mf.target), amt);
    }
    return;
  }

  /* Ferramentas: 't.from' -> S.tools.t.from */
  if (t.dataset.tool) {
    const [grp, key] = t.dataset.tool.split('.');
    if (key === 'from' || key === 'to') { if (grp === 't') t.value = maskMac(t.value); }
    if (grp === 't' && key === 'key') t.value = maskKey(t.value);
    S.tools[grp][key] = t.value;
    if (grp === 'd') { S.tools.d.preview = null; S.tools.d.matched = 0; S.tools.d.applied = null; }
    return;
  }

  if (t.dataset.acct) { S.acct[t.dataset.acct] = t.value; S.acct.err = ''; return; }
  if (t.dataset.price) { priceSet(t.dataset.price, t.value); return; }
});

document.addEventListener('change', ev => {
  const t = ev.target, k = t.dataset.change;
  if (k === 'months') { S.form.months = +t.value; S.reqId = uuid(); render(); }
  else if (k === 'pq') { S.pq = t.value; render(); }
  else if (k === 'plsel') {
    S.form.plSel = t.value; S.reqId = uuid();
    const hit = savedPlaylists().find(([key]) => key === t.value);
    if (hit) Object.assign(S.form, { kind: hit[1].kind, url: hit[1].url, user: hit[1].user, pass: hit[1].pass, m3u: hit[1].m3u });
    render();
  } else if (t.dataset.mf === 'target' || t.dataset.mf === 'hours') { S.mf[t.dataset.mf] = t.value; render(); }
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') {
    if (S.modal) return ACTIONS.close();
    if (S.nav) { S.nav = false; render(); }
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.session && !S.busy && !S.loading && !S.modal && Date.now() - S.loadedAt > 60000) loadAll();
});

/* =====================================================================
   INÍCIO
   ===================================================================== */
function resetState() {
  S.session = null; S.noProfile = false; S.data = { profiles: [], wallets: {}, ledger: [], customers: [] };
  S.result = null; S.error = null; S.modal = null; S.route = 'painel'; S.nav = false;
  S.cfilter = 'all'; S.q = ''; S.pq = ''; S.pkind = 'all'; S.plOpen = null;
  S.tools.t = { from: '', to: '', key: '', name: '', busy: false, err: '', ok: null };
  S.tools.d = { from: '', to: '', busy: false, err: '', preview: null, matched: 0, applied: null };
  S.acct = { p1: '', p2: '', show: false, err: '', ok: false, busy: false };
  Object.assign(S.form, FORM0); S.reqId = uuid();
}
async function boot() {
  if (!CONFIGURED || !sb) { S.booting = false; return render(); }
  render();
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { resetState(); render(); }
    else if (session) S.session = session;   // só guarda; nada de chamadas aqui dentro
  });
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  S.booting = false;
  if (S.session) await loadAll(); else render();
}
boot();
window.__painel = { S, render };
