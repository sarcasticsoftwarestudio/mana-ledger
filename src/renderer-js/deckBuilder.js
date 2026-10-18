import { cardMeta } from './analytics.js';
import { SCRYFALL_COLLECTION } from './constants.js';
import {
  BASIC_LAND_NAMES, CARD_KINGDOM_BUILDER_URL, COMMANDER_DECK_SIZE, DEFAULT_ROLES, FALLBACK_ROLE,
  budgetSummary, builderSettings, cardRoles, classifyRoles, commanderEligibility, commanderIdentity,
  copyLimitFor, deckRoles, formatVendorList, partnerQuery, roleSummary, scryfallBuilderQuery,
  tcgMassEntryUrl, validCommanderPair, validateCommanderDeck, vendorLines,
} from './deckBuilderCore.js';
import { showDeckExportModal } from './deckIO.js';
import {
  addCardToDeck, captureScryfallCard, createDeck, deckById, deckCardOwnedQty, deckCardPrice,
  deckOwnedMaps, deleteDeck, sidImageUrl,
} from './decks.js';
import { registerActions } from './dispatch.js';
import { copyToClipboard, hideModal, openCardOnScryfall, promptText, showContextMenu, showModal } from './modals.js';
import { bulkDataEnabled } from './prices.js';
import { render } from './render.js';
import { collection, ui } from './state.js';
import { autoSave } from './storage.js';
import { esc, fmt, netFetch, sleep, toast, uid } from './utils.js';


// ─────────────────────────────────────────────────────────────────────────────
// DECK BUILDER — a Commander workspace inside the Decks tab. A builder deck is
// an ordinary deck (format 'commander') with a `builder` settings object:
// budget, budget mode, price mode, role targets and custom roles. Cards carry
// optional `roles` overrides. Rules/roles/budget math live in the pure
// deckBuilderCore.js; this module is the UI around it.
// ─────────────────────────────────────────────────────────────────────────────

registerActions({
  'db-new':          () => showNewBuilderModal(),
  'db-open':         (el) => openDeckBuilder(el.dataset.arg),
  'db-close':        () => { ui.decks.builderId = null; render(); },
  'db-as-list':      (el) => { ui.decks.builderId = null; ui.decks.deckId = el.dataset.arg; render(); },
  'db-search':       () => runBuilderSearch(),
  'db-more':         () => runBuilderSearch({ more: true }),
  'db-role-filter':  (el) => { ui.decks.builder.role = el.dataset.val; runBuilderSearch(); },
  'db-source':       (el) => { ui.decks.builder.source = el.dataset.val; runBuilderSearch(); },
  'db-add':          (el) => addResult(+el.dataset.idx, el.dataset.board || 'main'),
  'db-remove':       (el) => removeEntry(el.dataset.arg),
  'db-partner':      () => { ui.decks.builder.partner = true; resetResults(); runBuilderSearch(); },
  'db-partner-done': () => { ui.decks.builder.partner = false; resetResults(); runBuilderSearch(); },
  'db-add-role':     () => addCustomRole(),
  'db-del-role':     (el) => deleteCustomRole(el.dataset.arg),
  'db-buy':          (el) => showBuilderBuyModal(el.dataset.arg),
  'db-delete':       (el) => { const d = deckById(el.dataset.arg); if (d) deleteDeck(d); },
});

// ── Session state (not persisted) ───────────────────────────────────────────
let results = [];          // current search results (see toResult)
let nextPage = null;       // Scryfall next_page URL
let totalResults = 0;
let searching = false;
let searchError = '';
const cheapest = new Map();      // card name → cheapest-printing price (bulk index)
const cheapestAsked = new Set();
const metaAsked = new Set();     // scryfall ids we already tried to fetch

function resetResults() { results = []; nextPage = null; totalResults = 0; searchError = ''; }

const activeDeck = () => (ui.decks.builderId ? deckById(ui.decks.builderId) : null);
const commanders = (deck) => (deck.cards || []).filter(c => c.board === 'commander');
const metaOf = (sid) => cardMeta(sid);

function save() { autoSave(); }

// Re-render without losing the scroll position of the two scrolling panes.
function rerender() {
  const keep = ['#content', '.db-results', '.db-groups'].map(sel => {
    const el = document.querySelector(sel);
    return [sel, el ? el.scrollTop : 0];
  });
  render();
  for (const [sel, top] of keep) { const el = document.querySelector(sel); if (el) el.scrollTop = top; }
}

// ── Pricing ─────────────────────────────────────────────────────────────────
// Budget price per card: in 'cheapest' mode the lower of this printing and the
// cheapest printing of the name anywhere (vendor carts buy by name), else the
// printing's own price.
export function builderPriceOf(deck, dc) {
  const own = deckCardPrice(dc);
  if (builderSettings(deck).priceMode !== 'cheapest') return own;
  const cheap = cheapest.get(dc.name);
  if (cheap == null) return own;
  return own == null ? cheap : Math.min(own, cheap);
}

function deckBudget(deck, maps = deckOwnedMaps()) {
  return budgetSummary(deck, { priceOf: dc => builderPriceOf(deck, dc), ownedQty: dc => deckCardOwnedQty(dc, maps) });
}

// ── Opening / creating ──────────────────────────────────────────────────────
export function openDeckBuilder(deckId) {
  const deck = deckById(deckId);
  if (!deck) return;
  if (!deck.builder) { deck.builder = {}; save(); }
  ui.decks.builderId = deck.id;
  ui.decks.deckId = null;
  ui.decks.builder.partner = false;
  resetResults();
  render();
  ensureBuilderData(deck);
  runBuilderSearch();
}

export function showNewBuilderModal() {
  showModal(`
    <h2>🛠 New Commander Deck</h2>
    <div style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.5">
      Pick a commander, set a budget, then fill the deck by role. Every Commander deck-building rule is checked as you go —
      100 cards, singleton, color identity, partner pairings and the official ban list.
    </div>
    <div class="form-group"><label>Deck name <span style="color:var(--text-muted);font-weight:400">(optional — defaults to your commander)</span></label>
      <input type="text" id="nb-name" placeholder="e.g. Budget Meren"></div>
    <div style="display:flex;gap:10px">
      <div class="form-group" style="flex:1"><label>Budget (USD)</label>
        <input type="number" id="nb-budget" min="0" step="5" placeholder="No limit"></div>
      <div class="form-group" style="flex:1.4"><label>Budget counts</label>
        <select id="nb-mode">
          <option value="total">The whole deck</option>
          <option value="missing">Only cards I still need to buy</option>
        </select></div>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
      <button class="btn" id="nb-cancel">Cancel</button>
      <button class="btn btn-primary" id="nb-create">Start building</button>
    </div>`);
  const create = () => {
    const name = document.getElementById('nb-name').value.trim();
    const budget = parseFloat(document.getElementById('nb-budget').value);
    const deck = createDeck(name || 'New Commander Deck', 'commander');
    deck.builder = {
      budget: Number.isFinite(budget) && budget > 0 ? budget : null,
      budgetMode: document.getElementById('nb-mode').value,
      priceMode: 'cheapest', roleTargets: {}, customRoles: [],
      autoName: !name,
    };
    hideModal();
    save();
    window.logger?.success('Deck', `Started Deck Builder deck “${deck.name}”`);
    openDeckBuilder(deck.id);
  };
  document.getElementById('nb-create').addEventListener('click', create);
  document.getElementById('nb-cancel').addEventListener('click', hideModal);
  document.getElementById('nb-name').addEventListener('keydown', e => { if (e.key === 'Enter') create(); });
  document.getElementById('nb-name').focus();
}

// Fill in what validation and budgeting need: Commander legality/identity for
// every card (Scryfall /cards/collection, once per card per session) and the
// cheapest-printing price per name (local bulk index, when enabled).
async function ensureBuilderData(deck) {
  let changed = false;
  const ids = [...new Set((deck.cards || [])
    .map(c => c.scryfallId)
    .filter(sid => sid && !metaAsked.has(sid) && (!metaOf(sid) || metaOf(sid).legal_commander == null)))];
  for (let i = 0; i < ids.length; i += 75) {
    const chunk = ids.slice(i, i + 75);
    chunk.forEach(id => metaAsked.add(id));
    try {
      const resp = await netFetch(SCRYFALL_COLLECTION, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: chunk.map(id => ({ id })) }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      for (const card of data.data || []) { captureScryfallCard(card); changed = true; }
    } catch (err) {
      window.logger?.warn('Deck', `Deck Builder couldn’t load card data for ${chunk.length} cards: ${err.message}`);
    }
    if (i + 75 < ids.length) await sleep(120);
  }

  if (bulkDataEnabled() && window.api?.bulk?.cheapestByNames) {
    const names = [...new Set((deck.cards || []).map(c => c.name))].filter(n => !cheapestAsked.has(n));
    names.forEach(n => cheapestAsked.add(n));
    if (names.length) {
      try {
        const r = await window.api.bulk.cheapestByNames(names);
        for (const [name, hit] of Object.entries(r?.found || {})) { cheapest.set(name, hit.price); changed = true; }
      } catch { /* bulk index cold — printing prices still work */ }
    }
  }

  if (changed) {
    save();
    if (ui.activeTab === 'decks' && ui.decks.builderId === deck.id) rerender();
  }
}

// ── Search ──────────────────────────────────────────────────────────────────
function searchMode(deck) {
  const cmd = commanders(deck);
  if (!cmd.length) return 'commander';
  if (ui.decks.builder.partner && cmd.length === 1) return 'partner';
  return 'cards';
}

// Effective per-card price cap: the user's max, tightened to the remaining
// budget when "fit budget" is on.
function priceCap(deck) {
  const st = ui.decks.builder;
  const userMax = parseFloat(st.maxPrice);
  let cap = Number.isFinite(userMax) && userMax >= 0 ? userMax : null;
  if (st.fit) {
    const b = deckBudget(deck);
    if (b.remaining != null) cap = cap == null ? Math.max(0, b.remaining) : Math.min(cap, Math.max(0, b.remaining));
  }
  return cap;
}

// Cheapest buyable finish of a Scryfall printing — some printings (many promos
// and Secret Lairs) only have a foil or etched price.
const FINISH_OF = { usd: 'normal', usd_foil: 'foil', usd_etched: 'etched' };
function priceFromScryfall(card) {
  const p = card.prices || {};
  for (const k of ['usd', 'usd_foil', 'usd_etched']) {
    const v = parseFloat(p[k]);
    if (Number.isFinite(v)) return { price: v, foil: FINISH_OF[k] };
  }
  return { price: null, foil: 'normal' };
}

function metaFromScryfall(card) {
  return {
    type_line: card.type_line || '',
    oracle_text: card.oracle_text || card.card_faces?.[0]?.oracle_text || '',
    color_identity: card.color_identity || [],
    cmc: card.cmc ?? null,
  };
}

function ownedByName() {
  const m = new Map();
  for (const c of collection.cards) {
    if (c.status === 'sold') continue;
    const k = (c.name || '').toLowerCase();
    m.set(k, (m.get(k) || 0) + (c.quantity || 1));
  }
  return m;
}

export async function runBuilderSearch({ more = false } = {}) {
  const deck = activeDeck();
  if (!deck) return;
  const st = ui.decks.builder;
  const mode = searchMode(deck);

  if (st.source === 'collection') {
    results = searchCollection(deck, mode);
    nextPage = null; totalResults = results.length; searchError = '';
    rerender();
    return;
  }

  let url;
  if (more && nextPage) url = nextPage;
  else {
    let text = st.q, isCommander = mode === 'commander', identity = commanderIdentity(deck, metaOf);
    if (mode === 'partner') {
      const c = commanders(deck)[0];
      const pq = partnerQuery(c.name, metaOf(c.scryfallId));
      if (!pq) { results = []; searchError = `${c.name} has no partner ability.`; rerender(); return; }
      text = [st.q, pq.text].filter(Boolean).join(' ');
      isCommander = pq.commander;
      identity = null;
    }
    const q = scryfallBuilderQuery({
      text, commander: isCommander, identity: mode === 'cards' ? identity : null,
      role: mode === 'cards' ? st.role : '', maxPrice: priceCap(deck),
    });
    const order = st.order === 'usd' ? 'usd&dir=asc' : st.order === 'name' ? 'name' : 'edhrec';
    url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=cards&order=${order}`;
  }

  searching = true; searchError = '';
  if (!more) results = [];
  rerender();
  try {
    const resp = await netFetch(url);
    if (resp.status === 404) { results = more ? results : []; nextPage = null; totalResults = results.length; return; }
    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try { detail = (await resp.json()).details || detail; } catch { /* keep status */ }
      throw new Error(detail);
    }
    const data = await resp.json();
    const owned = ownedByName();
    const page = (data.data || []).map(card => ({
      src: 'scryfall', scryCard: card,
      scryfallId: (card.id || '').toLowerCase(), name: card.name,
      setCode: card.set || '', setName: card.set_name || '', collectorNumber: card.collector_number || '',
      typeLine: card.type_line || '', ...priceFromScryfall(card),
      roles: classifyRoles(metaFromScryfall(card)), owned: owned.get((card.name || '').toLowerCase()) || 0,
      gameChanger: !!card.game_changer,
    }));
    results = more ? [...results, ...page] : page;
    nextPage = data.has_more ? data.next_page : null;
    totalResults = data.total_cards || results.length;
  } catch (err) {
    searchError = `Scryfall search failed: ${err.message}`;
  } finally {
    searching = false;
    if (ui.decks.builderId === deck.id) rerender();
  }
}

function searchCollection(deck, mode) {
  const st = ui.decks.builder;
  const q = (st.q || '').trim().toLowerCase();
  const identity = commanderIdentity(deck, metaOf);
  const cap = priceCap(deck);
  const free = builderSettings(deck).budgetMode === 'missing';
  const seen = new Map();
  for (const c of collection.cards) {
    if (c.status === 'sold' || !c.scryfallId) continue;
    const m = metaOf(c.scryfallId);
    const key = c.name.toLowerCase();
    if (seen.has(key)) { seen.get(key).owned += c.quantity || 1; continue; }
    if (q && !c.name.toLowerCase().includes(q) && !(m?.type_line || '').toLowerCase().includes(q)
        && !(m?.oracle_text || '').toLowerCase().includes(q)) continue;
    if (m?.legal_commander === 'banned' || m?.legal_commander === 'not_legal') continue;
    if (mode !== 'cards') {
      if (commanderEligibility(m).ok !== true) continue;
    } else {
      if (identity && m && (m.color_identity || []).some(x => !identity.includes(x))) continue;
      if (identity && !m) continue;
      if (st.role && !classifyRoles(m).includes(st.role)) continue;
    }
    const price = deckCardPrice({ scryfallId: c.scryfallId, foil: c.foil || 'normal' });
    if (!free && cap != null && price != null && price > cap) continue;
    seen.set(key, {
      src: 'collection', cardId: c.id, scryfallId: c.scryfallId, name: c.name,
      setCode: c.setCode, setName: c.setName, collectorNumber: c.collectorNumber, foil: c.foil || 'normal',
      typeLine: m?.type_line || '', price, roles: classifyRoles(m), owned: c.quantity || 1,
      gameChanger: !!m?.game_changer,
    });
  }
  const out = [...seen.values()];
  out.sort(st.order === 'usd' ? (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9) : (a, b) => a.name.localeCompare(b.name));
  return out.slice(0, 120);
}

// ── Editing ─────────────────────────────────────────────────────────────────
function addResult(idx, board) {
  const deck = activeDeck();
  const r = results[idx];
  if (!deck || !r) return;
  if (r.scryCard) captureScryfallCard(r.scryCard);
  if (r.price != null && !cheapest.has(r.name)) cheapest.set(r.name, r.price);
  const mode = searchMode(deck);

  if (mode !== 'cards') {
    const cmd = commanders(deck);
    if (cmd.length >= 2) { toast('A deck can have at most two commanders', 'error'); return; }
    if (cmd.length === 1) {
      const pair = validCommanderPair({ name: cmd[0].name, meta: metaOf(cmd[0].scryfallId) }, { name: r.name, meta: metaOf(r.scryfallId) });
      if (!pair.ok) { toast(`Can’t pair them — ${pair.reason}`, 'error', 6000); return; }
    }
    // A card already in the 99 moves up to the command zone instead of duplicating.
    const existing = (deck.cards || []).find(c => c.board !== 'commander' && c.name.toLowerCase() === r.name.toLowerCase());
    if (existing) { existing.board = 'commander'; existing.quantity = 1; }
    else addCardToDeck(deck, r, 'commander', 1);
    if (deck.builder?.autoName) deck.name = commanders(deck).map(c => c.name.split(' // ')[0]).join(' & ');
    ui.decks.builder.partner = false;
    ui.decks.builder.q = '';
    resetResults();
    save();
    toast(`👑 ${r.name} is your commander`, 'success');
    ensureBuilderData(deck);
    runBuilderSearch();
    return;
  }

  const inDeck = (deck.cards || []).filter(c => c.name.toLowerCase() === r.name.toLowerCase());
  const live = inDeck.filter(c => c.board === 'main' || c.board === 'commander').reduce((s, c) => s + (c.quantity || 1), 0);
  if (board === 'main' && live >= copyLimitFor(r.name, metaOf(r.scryfallId))) {
    toast(`${r.name} is already in the deck (singleton)`, 'warning');
    return;
  }
  if (board === 'maybe' && inDeck.some(c => c.board === 'maybe')) { toast(`${r.name} is already being considered`, 'info'); return; }
  const entry = addCardToDeck(deck, r, board, 1);
  const role = ui.decks.builder.role;
  if (role && board === 'main' && !entry.roles) {
    const auto = cardRoles(entry, metaOf(entry.scryfallId));
    if (auto[0] !== role) entry.roles = [role, ...auto.filter(x => x !== role && x !== FALLBACK_ROLE)];
  }
  save();
  rerender();
  ensureBuilderData(deck);
}

function removeEntry(entryId) {
  const deck = activeDeck();
  if (!deck) return;
  const dc = deck.cards.find(c => c.id === entryId);
  if (!dc) return;
  if ((dc.quantity || 1) > 1) dc.quantity -= 1;
  else deck.cards = deck.cards.filter(c => c.id !== entryId);
  if (dc.board === 'commander' && !commanders(deck).length) { resetResults(); runBuilderSearch(); }
  save();
  rerender();
}

function setPrimaryRole(deck, dc, role) {
  const current = cardRoles(dc, metaOf(dc.scryfallId));
  dc.roles = [role, ...current.filter(r => r !== role)];
  save();
  rerender();
}

function toggleRole(deck, dc, role) {
  const current = cardRoles(dc, metaOf(dc.scryfallId));
  const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role];
  dc.roles = next.length ? next : [FALLBACK_ROLE];
  save();
  rerender();
}

function addCustomRole() {
  const deck = activeDeck();
  if (!deck) return;
  promptText('New role', 'e.g. Tokens, Sac outlets, Tribal payoffs', label => {
    deck.builder = deck.builder || {};
    deck.builder.customRoles = [...(deck.builder.customRoles || []), { id: `c_${uid()}`, label, target: null }];
    save();
    render();
  });
}

function deleteCustomRole(roleId) {
  const deck = activeDeck();
  if (!deck?.builder?.customRoles) return;
  const role = deck.builder.customRoles.find(r => r.id === roleId);
  if (!role || !confirm(`Delete the “${role.label}” role? Its cards move to their next role (or Synergy).`)) return;
  deck.builder.customRoles = deck.builder.customRoles.filter(r => r.id !== roleId);
  for (const dc of deck.cards) if (dc.roles?.includes(roleId)) {
    dc.roles = dc.roles.filter(r => r !== roleId);
    if (!dc.roles.length) delete dc.roles;
  }
  save();
  render();
}

function setRoleTarget(deck, roleId, value) {
  deck.builder = deck.builder || {};
  deck.builder.roleTargets = { ...(deck.builder.roleTargets || {}) };
  const n = parseInt(value);
  deck.builder.roleTargets[roleId] = Number.isFinite(n) && n >= 0 ? n : null;
  save();
  rerender();
}

// ── Rendering ───────────────────────────────────────────────────────────────
const PIP = { W: 'var(--mtg-w)', U: 'var(--mtg-u)', B: 'var(--mtg-b)', R: 'var(--mtg-r)', G: 'var(--mtg-g)', C: 'var(--mtg-c)' };
const pips = (ids) => (ids && ids.length ? ids : ['C'])
  .map(c => `<span class="db-pip" style="background:${PIP[c] || PIP.C}" title="${c}">${c}</span>`).join('');

export function renderDeckBuilder(deck) {
  const maps = deckOwnedMaps();
  const s = builderSettings(deck);
  const budget = deckBudget(deck, maps);
  const issues = validateCommanderDeck(deck, metaOf);
  const errors = issues.filter(i => i.level === 'error');
  const cmd = commanders(deck);
  const main = deck.cards.filter(c => (c.board || 'main') === 'main');
  const size = main.reduce((n, c) => n + (c.quantity || 1), 0) + cmd.length;
  const nonland = main.filter(c => !/\bLand\b/.test((metaOf(c.scryfallId)?.type_line || '').split(' // ')[0]));
  const mvs = nonland.map(c => metaOf(c.scryfallId)?.cmc).filter(v => v != null);
  const avgMv = mvs.length ? (mvs.reduce((a, b) => a + b, 0) / mvs.length).toFixed(2) : '—';
  const gameChangers = [...cmd, ...main].filter(c => metaOf(c.scryfallId)?.game_changer);
  const ownedCount = [...cmd, ...main].reduce((n, c) => n + Math.min(c.quantity || 1, deckCardOwnedQty(c, maps)), 0);

  const budgetBar = budget.budget != null
    ? `<div class="db-bar"><div class="db-bar-fill" style="width:${Math.min(100, budget.pct)}%;background:${budget.over ? 'var(--red)' : budget.pct > 90 ? 'var(--orange)' : 'var(--green)'}"></div></div>
       <div class="db-budget-line"><strong class="${budget.over ? 'db-over' : ''}">${fmt(budget.spent)}</strong> of ${fmt(budget.budget)}
         · ${budget.over ? `<span class="db-over">${fmt(-budget.remaining)} over budget</span>` : `${fmt(budget.remaining)} left`}
         ${budget.unpriced ? ` · <span title="No price data for these cards">${budget.unpriced} unpriced</span>` : ''}</div>`
    : `<div class="db-budget-line"><strong>${fmt(budget.spent)}</strong> ${s.budgetMode === 'missing' ? 'to buy' : 'total'} · no budget set${budget.unpriced ? ` · ${budget.unpriced} unpriced` : ''}</div>`;

  const legality = errors.length === 0 && cmd.length
    ? `<div class="deck-legality deck-legality-ok"><span>✓</span> Legal Commander deck${issues.length ? ` <span class="deck-issue-warn">· ${esc(issues[0].msg)}</span>` : ''}</div>`
    : `<div class="deck-legality deck-legality-bad">
        <div class="deck-legality-title"><span>✕</span> ${errors.length} rule${errors.length !== 1 ? 's' : ''} not met yet</div>
        ${issues.map(i => `<div class="deck-issue ${i.level === 'warn' ? 'deck-issue-warn' : ''}">• ${esc(i.msg)}</div>`).join('')}
      </div>`;

  return `
    <div class="deck-detail db-page">
      <div class="deck-detail-head">
        <button class="btn btn-ghost" data-act="db-close" title="Back to decks">← Decks</button>
        <h2 class="deck-title" id="dbTitle" title="Click to rename">🛠 ${esc(deck.name)} <span class="deck-title-edit">✎</span></h2>
        <span style="flex:1"></span>
        <button class="btn btn-ghost" data-act="db-as-list" data-arg="${esc(deck.id)}" title="Open the regular deck view (gallery, ownership filters, import/export)">▤ Deck view</button>
        <button class="btn btn-primary" data-act="db-buy" data-arg="${esc(deck.id)}" title="Export for TCGplayer or Card Kingdom">🛒 Buy / Export</button>
        <button class="btn btn-ghost" data-act="db-delete" data-arg="${esc(deck.id)}" title="Delete deck" style="color:var(--red)">🗑</button>
      </div>

      <div class="db-top">
        <div class="db-budget">
          <div class="db-budget-controls">
            <label>Budget $<input type="number" id="dbBudget" min="0" step="5" value="${s.budget ?? ''}" placeholder="none"></label>
            <select id="dbBudgetMode" title="What the budget counts">
              <option value="total" ${s.budgetMode === 'total' ? 'selected' : ''}>Whole deck</option>
              <option value="missing" ${s.budgetMode === 'missing' ? 'selected' : ''}>Only cards I need to buy</option>
            </select>
            <select id="dbPriceMode" title="Which price each card is budgeted at">
              <option value="cheapest" ${s.priceMode === 'cheapest' ? 'selected' : ''}>Cheapest printing</option>
              <option value="printing" ${s.priceMode === 'printing' ? 'selected' : ''}>Printing in deck</option>
            </select>
          </div>
          ${budgetBar}
        </div>
        <div class="deck-stats-strip db-stats">
          <div class="deck-stat"><div class="deck-stat-val ${size === COMMANDER_DECK_SIZE ? 'price-up' : ''}">${size}/${COMMANDER_DECK_SIZE}</div><div class="deck-stat-lbl">Cards</div></div>
          <div class="deck-stat"><div class="deck-stat-val">${avgMv}</div><div class="deck-stat-lbl">Avg MV</div></div>
          <div class="deck-stat" title="Commander Brackets: 0 Game Changers fits brackets 1–2, up to 3 fits bracket 3, more means bracket 4+.${gameChangers.length ? '\n' + esc(gameChangers.map(c => c.name).join(', ')) : ''}"><div class="deck-stat-val">${gameChangers.length}</div><div class="deck-stat-lbl">Game Changers</div></div>
          <div class="deck-stat"><div class="deck-stat-val">${ownedCount}/${size}</div><div class="deck-stat-lbl">Owned</div></div>
        </div>
      </div>

      ${legality}

      <div class="db-main">
        <div class="db-groups">
          ${renderCommanderZone(deck, cmd, maps)}
          ${cmd.length ? renderRoleGroups(deck, maps) : ''}
        </div>
        <div class="db-search-pane">
          ${renderSearchPane(deck)}
        </div>
      </div>
    </div>`;
}

function renderCommanderZone(deck, cmd, maps) {
  if (!cmd.length) return `
    <div class="db-cmd-empty">
      <div style="font-size:30px">👑</div>
      <h3>Step 1 — choose your commander</h3>
      <p>Search on the right. Your commander sets the deck’s color identity; every other card must fit inside it.</p>
    </div>`;
  const first = cmd[0];
  const canPartner = cmd.length === 1 && partnerQuery(first.name, metaOf(first.scryfallId));
  return `
    <div class="db-cmd-zone">
      ${cmd.map(c => {
        const m = metaOf(c.scryfallId);
        const p = builderPriceOf(deck, c);
        return `<div class="db-cmd" data-db-entry="${esc(c.id)}" data-db-sid="${esc(c.scryfallId || '')}">
          ${c.scryfallId ? `<img src="${esc(sidImageUrl(c.scryfallId, 'art_crop'))}" alt="" data-imgerr="remove">` : ''}
          <div class="db-cmd-body">
            <div class="db-cmd-label">Commander</div>
            <div class="db-cmd-name">${esc(c.name)}</div>
            <div class="db-cmd-meta">${pips(m?.color_identity)} <span>${p != null ? fmt(p) : '—'}</span>
              ${deckCardOwnedQty(c, maps) ? '<span class="owned-pill own-full">✓ Owned</span>' : ''}</div>
          </div>
          <button class="btn btn-ghost btn-sm db-x" data-act="db-remove" data-arg="${esc(c.id)}" title="Remove commander">✕</button>
        </div>`;
      }).join('')}
      ${canPartner ? `<button class="btn btn-ghost btn-sm" data-act="db-partner" title="${esc(first.name)} can have a second commander">＋ Add partner / background</button>` : ''}
    </div>`;
}

function renderRoleGroups(deck, maps) {
  const groups = roleSummary(deck, metaOf);
  const roleOptions = deckRoles(deck);
  const maybe = deck.cards.filter(c => c.board === 'maybe');
  const side = deck.cards.filter(c => c.board === 'side');
  const visible = groups.filter(g => g.cards.length || g.target != null || g.custom);
  return `
    ${visible.map(g => {
      const met = g.target != null && g.count >= g.target;
      const pct = g.target ? Math.min(100, (g.count / g.target) * 100) : 0;
      const value = g.cards.reduce((s, c) => s + (builderPriceOf(deck, c) ?? 0) * (c.quantity || 1), 0);
      return `<div class="db-group">
        <div class="db-group-head">
          <span class="db-group-title">${g.icon} ${esc(g.label)}</span>
          <span class="db-group-count ${g.target == null ? '' : met ? 'db-met' : 'db-short'}">${g.count}${g.target != null ? ` / ` : ''}</span>
          ${g.target != null || g.custom || g.id !== FALLBACK_ROLE
            ? `<input type="number" class="db-target" data-role="${esc(g.id)}" min="0" value="${g.target ?? ''}" placeholder="—" title="Target count for ${esc(g.label)}">`
            : ''}
          ${g.target ? `<div class="db-bar db-bar-sm"><div class="db-bar-fill" style="width:${pct}%;background:${met ? 'var(--green)' : 'var(--accent)'}"></div></div>` : '<span style="flex:1"></span>'}
          <span class="db-group-val">${fmt(value)}</span>
          ${g.custom ? `<button class="btn btn-ghost btn-sm" data-act="db-del-role" data-arg="${esc(g.id)}" title="Delete this role">✕</button>` : ''}
        </div>
        ${g.cards.length
          ? `<table class="deck-table db-table"><tbody>${g.cards.slice().sort((a, b) => a.name.localeCompare(b.name)).map(dc => renderRow(deck, dc, maps, roleOptions)).join('')}</tbody></table>`
          : `<div class="db-group-empty">No ${esc(g.label.toLowerCase())} yet${ROLE_HINT[g.id] ? ` — ${ROLE_HINT[g.id]}` : ''}</div>`}
      </div>`;
    }).join('')}
    <div style="margin:4px 0 18px"><button class="btn btn-ghost btn-sm" data-act="db-add-role">＋ Add a role</button></div>
    ${side.length ? renderFlatBoard(deck, '⚠ Sideboard (not allowed in Commander)', side, maps) : ''}
    ${maybe.length ? renderFlatBoard(deck, '🤔 Considering — not in the deck', maybe, maps) : ''}`;
}

const ROLE_HINT = {
  land: 'click the Lands chip in the search to find some',
  ramp: 'mana rocks, dorks and land fetchers',
  draw: 'keep your hand full',
  removal: 'answers to the threats across the table',
  wipe: 'resets for when you fall behind',
};

function renderRow(deck, dc, maps, roleOptions) {
  const roles = cardRoles(dc, metaOf(dc.scryfallId));
  const primary = roles[0];
  const p = builderPriceOf(deck, dc);
  const qty = dc.quantity || 1;
  const owned = Math.min(qty, deckCardOwnedQty(dc, maps));
  const extra = roles.slice(1).map(r => roleOptions.find(o => o.id === r)).filter(Boolean);
  const m = metaOf(dc.scryfallId);
  const flag = m?.legal_commander === 'banned' ? '<span class="db-flag" title="Banned in Commander">BANNED</span>'
    : m?.legal_commander === 'not_legal' ? '<span class="db-flag" title="Not legal in Commander">NOT LEGAL</span>' : '';
  return `<tr class="deck-row" data-db-entry="${esc(dc.id)}" data-db-sid="${esc(dc.scryfallId || '')}">
    <td class="deck-qty">${qty > 1 ? `${qty}×` : ''}</td>
    <td class="deck-name">${esc(dc.name)} ${flag} ${m?.game_changer ? '<span class="db-gc" title="Game Changer (Commander Brackets)">GC</span>' : ''}
      ${extra.map(r => `<span class="db-chip" title="Also counts as ${esc(r.label)}">${r.icon}</span>`).join('')}</td>
    <td class="db-mv">${m?.cmc != null && !/\bLand\b/.test((m.type_line || '').split(' // ')[0]) ? m.cmc : ''}</td>
    <td class="db-role"><select class="db-role-select" data-entry="${esc(dc.id)}" title="Role (right-click the card for secondary roles)">
      ${roleOptions.map(r => `<option value="${esc(r.id)}" ${r.id === primary ? 'selected' : ''}>${r.icon} ${esc(r.label)}</option>`).join('')}
    </select></td>
    <td class="deck-owned">${owned >= qty ? '<span class="owned-pill own-full">✓ Owned</span>' : ''}</td>
    <td class="deck-price">${p != null ? fmt(p * qty) : '<span style="color:var(--text-dim)">—</span>'}</td>
    <td class="db-x-cell"><button class="btn btn-ghost btn-sm db-x" data-act="db-remove" data-arg="${esc(dc.id)}" title="Remove">✕</button></td>
  </tr>`;
}

function renderFlatBoard(deck, title, cards, maps) {
  return `<div class="db-group">
    <div class="db-group-head"><span class="db-group-title">${title}</span><span style="flex:1"></span></div>
    <table class="deck-table db-table"><tbody>
      ${cards.map(dc => {
        const p = builderPriceOf(deck, dc);
        return `<tr class="deck-row" data-db-entry="${esc(dc.id)}" data-db-sid="${esc(dc.scryfallId || '')}">
          <td class="deck-name">${esc(dc.name)}</td>
          <td class="deck-owned">${deckCardOwnedQty(dc, maps) ? '<span class="owned-pill own-full">✓ Owned</span>' : ''}</td>
          <td class="deck-price">${p != null ? fmt(p) : '—'}</td>
          <td class="db-x-cell"><button class="btn btn-ghost btn-sm db-x" data-act="db-remove" data-arg="${esc(dc.id)}" title="Remove">✕</button></td>
        </tr>`;
      }).join('')}
    </tbody></table>
  </div>`;
}

function renderSearchPane(deck) {
  const st = ui.decks.builder;
  const mode = searchMode(deck);
  const cap = priceCap(deck);
  const free = builderSettings(deck).budgetMode === 'missing';
  const inDeck = new Set(deck.cards.filter(c => c.board === 'main' || c.board === 'commander').map(c => c.name.toLowerCase()));
  const roleChip = (id, label) => `<button class="db-role-chip ${st.role === id ? 'active' : ''}" data-act="db-role-filter" data-val="${esc(id)}">${label}</button>`;
  const srcBtn = (id, label) => `<button class="btn ${st.source === id ? 'btn-primary' : 'btn-ghost'} btn-sm" data-act="db-source" data-val="${id}">${label}</button>`;
  const heading = mode === 'commander' ? '👑 Choose a commander'
    : mode === 'partner' ? `👑 Pick a partner for ${esc(commanders(deck)[0].name)}` : '＋ Add cards';

  const rows = results.map((r, i) => {
    const already = mode === 'cards' && inDeck.has(r.name.toLowerCase()) && !BASIC_LAND_NAMES.has(r.name.toLowerCase());
    const priceTxt = free && r.owned ? '<span class="price-up" title="You own a copy — free under this budget mode">owned</span>'
      : r.price != null ? fmt(r.price) : '—';
    const roleIcon = mode === 'cards' ? (DEFAULT_ROLES.find(x => x.id === r.roles[0])?.icon || '') : '';
    return `<div class="db-result ${already ? 'db-result-in' : ''}" data-db-sid="${esc(r.scryfallId || '')}" data-db-result="${i}">
      <div class="db-result-main">
        <div class="db-result-name">${esc(r.name)} ${r.gameChanger ? '<span class="db-gc" title="Game Changer">GC</span>' : ''}</div>
        <div class="db-result-type">${roleIcon} ${esc(r.typeLine || '')}</div>
      </div>
      ${r.owned && !(free) ? '<span class="owned-pill own-full" title="In your collection">✓</span>' : ''}
      <span class="db-result-price">${priceTxt}</span>
      ${mode !== 'cards'
        ? `<button class="btn btn-primary btn-sm" data-act="db-add" data-idx="${i}">👑 Choose</button>`
        : already
          ? '<span class="db-in-deck">In deck</span>'
          : `<button class="btn btn-sm" data-act="db-add" data-idx="${i}" data-board="main" title="Add to deck">＋</button>
             <button class="btn btn-ghost btn-sm" data-act="db-add" data-idx="${i}" data-board="maybe" title="Add to Considering">?</button>`}
    </div>`;
  }).join('');

  return `
    <div class="db-search-head">
      <div class="db-search-title">${heading}</div>
      ${mode === 'partner' ? '<button class="btn btn-ghost btn-sm" data-act="db-partner-done">Cancel</button>' : ''}
      <div style="display:flex;gap:4px;margin-left:auto">${srcBtn('scryfall', '🌐 Scryfall')}${srcBtn('collection', '📚 My collection')}</div>
    </div>
    <div class="db-search-row">
      <input type="text" id="dbQuery" placeholder="${mode === 'cards' ? 'Name, type or rules text… (Enter)' : 'Commander name, type… (Enter)'}" value="${esc(st.q)}">
      <button class="btn btn-sm" data-act="db-search">Search</button>
    </div>
    ${mode === 'cards' ? `<div class="db-role-chips">
      ${roleChip('', 'All')}${DEFAULT_ROLES.filter(r => r.id !== FALLBACK_ROLE).map(r => roleChip(r.id, `${r.icon} ${r.label}`)).join('')}
    </div>` : ''}
    <div class="db-search-opts">
      <select id="dbOrder" title="Sort">
        <option value="edhrec" ${st.order === 'edhrec' ? 'selected' : ''}>Most played (EDHREC)</option>
        <option value="usd" ${st.order === 'usd' ? 'selected' : ''}>Cheapest first</option>
        <option value="name" ${st.order === 'name' ? 'selected' : ''}>Name</option>
      </select>
      <label title="Highest price per card">Max $<input type="number" id="dbMaxPrice" min="0" step="0.5" value="${esc(String(st.maxPrice ?? ''))}" placeholder="any"></label>
      <label title="Hide cards that cost more than what’s left of the budget"><input type="checkbox" id="dbFit" ${st.fit ? 'checked' : ''}> Fit remaining budget</label>
    </div>
    <div class="db-search-note">${cap != null ? `Showing cards up to ${fmt(cap)} · ` : ''}${st.source === 'scryfall'
      ? `${mode === 'cards' ? 'Commander-legal, inside your color identity · ' : ''}prices are each card’s cheapest printing`
      : 'Cards you own'}${totalResults ? ` · ${totalResults.toLocaleString()} match${totalResults === 1 ? '' : 'es'}` : ''}</div>
    <div class="db-results">
      ${searchError ? `<div class="db-search-msg" style="color:var(--red)">${esc(searchError)}</div>` : ''}
      ${rows || (searching ? '' : `<div class="db-search-msg">${mode === 'cards' ? 'No cards match — try another role or a higher price cap.' : 'No commanders match.'}</div>`)}
      ${searching ? '<div class="db-search-msg">Searching…</div>' : ''}
      ${nextPage && !searching ? '<div style="padding:10px"><button class="btn btn-sm" data-act="db-more">Load more</button></div>' : ''}
    </div>`;
}

// ── Listeners (text inputs/selects are wired here, not via data-act, so typing
// doesn't re-render on every keystroke) ─────────────────────────────────────
export function attachDeckBuilderListeners(showHover, hideHover) {
  const deck = activeDeck();
  if (!deck) return;
  const st = ui.decks.builder;
  const $ = id => document.getElementById(id);

  $('dbTitle')?.addEventListener('click', () => promptText('Rename deck', deck.name, name => {
    deck.name = name; if (deck.builder) deck.builder.autoName = false; render(); save();
  }));
  $('dbBudget')?.addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    deck.builder.budget = Number.isFinite(v) && v > 0 ? v : null;
    save(); rerender();
  });
  $('dbBudgetMode')?.addEventListener('change', e => { deck.builder.budgetMode = e.target.value; save(); rerender(); });
  $('dbPriceMode')?.addEventListener('change', e => { deck.builder.priceMode = e.target.value; save(); rerender(); });
  $('dbQuery')?.addEventListener('input', e => { st.q = e.target.value; });
  $('dbQuery')?.addEventListener('keydown', e => { if (e.key === 'Enter') { st.q = e.target.value; runBuilderSearch(); } });
  $('dbOrder')?.addEventListener('change', e => { st.order = e.target.value; runBuilderSearch(); });
  $('dbMaxPrice')?.addEventListener('change', e => { st.maxPrice = e.target.value; runBuilderSearch(); });
  $('dbFit')?.addEventListener('change', e => { st.fit = e.target.checked; runBuilderSearch(); });

  document.querySelectorAll('.db-target').forEach(inp => inp.addEventListener('change', () => setRoleTarget(deck, inp.dataset.role, inp.value)));
  document.querySelectorAll('.db-role-select').forEach(sel => sel.addEventListener('change', () => {
    const dc = deck.cards.find(c => c.id === sel.dataset.entry);
    if (dc) setPrimaryRole(deck, dc, sel.value);
  }));

  // Hover previews for deck rows and search results
  document.querySelectorAll('.db-page [data-db-sid]').forEach(el => {
    const sid = el.dataset.dbSid;
    if (!sid) return;
    const dc = el.dataset.dbEntry ? deck.cards.find(c => c.id === el.dataset.dbEntry) : null;
    const r = el.dataset.dbResult != null ? results[+el.dataset.dbResult] : null;
    const src = dc || r;
    if (!src) return;
    el.addEventListener('mouseenter', () => showHover(el, {
      name: src.name, scryfallId: sid, foil: src.foil || 'normal', setCode: src.setCode, setName: src.setName,
      collectorNumber: src.collectorNumber, rarity: '', binderName: deck.name, condition: '', quantity: src.quantity || 1,
    }));
    el.addEventListener('mouseleave', hideHover);
  });
}

// Right-click on a builder row: secondary roles, move between deck/considering,
// promote to commander, remove.
export function showBuilderCardContextMenu(x, y, entryId) {
  const deck = activeDeck();
  const dc = deck?.cards.find(c => c.id === entryId);
  if (!dc) return;
  const roles = cardRoles(dc, metaOf(dc.scryfallId));
  const move = (board, msg) => () => { dc.board = board; save(); rerender(); toast(msg, 'success'); };
  const eligible = commanderEligibility(metaOf(dc.scryfallId)).ok === true;
  showContextMenu(x, y, [
    { header: dc.name },
    ...(dc.board === 'main' ? [{ icon: '🏷', label: 'Roles', sub: deckRoles(deck).map(r => ({
      label: r.label, icon: roles.includes(r.id) ? '✓' : '', action: () => toggleRole(deck, dc, r.id),
    })) }] : []),
    ...(dc.board === 'main' && eligible && commanders(deck).length === 0
      ? [{ icon: '👑', label: 'Make commander', action: move('commander', `👑 ${dc.name} is your commander`) }] : []),
    ...(dc.board === 'main' ? [{ icon: '🤔', label: 'Move to Considering', action: move('maybe', `${dc.name} → Considering`) }] : []),
    ...(dc.board === 'maybe' || dc.board === 'side' ? [{ icon: '＋', label: 'Move into the deck', action: move('main', `${dc.name} → deck`) }] : []),
    ...(BASIC_LAND_NAMES.has(dc.name.toLowerCase()) ? [
      { icon: '＋', label: 'Add a copy', action: () => { dc.quantity = (dc.quantity || 1) + 1; save(); rerender(); } },
    ] : []),
    '---',
    { icon: '🌐', label: 'View on Scryfall', action: () => openCardOnScryfall(dc) },
    { icon: '📋', label: 'Copy name', action: () => copyToClipboard(dc.name, 'Name') },
    '---',
    { icon: '🗑', label: 'Remove from deck', danger: true, action: () => {
        deck.cards = deck.cards.filter(c => c.id !== dc.id);
        save(); rerender();
      } },
  ]);
}

// ── Buy / export ────────────────────────────────────────────────────────────
export function showBuilderBuyModal(deckId) {
  const deck = deckById(deckId);
  if (!deck) return;
  const maps = deckOwnedMaps();
  const opts = { scope: deck.builder?.budgetMode === 'missing' ? 'missing' : 'all', skipBasics: true, vendor: 'tcgplayer' };
  const ownedQty = dc => deckCardOwnedQty(dc, maps);

  const linesNow = () => vendorLines(deck, { scope: opts.scope, skipBasics: opts.skipBasics, ownedQty });
  const estimate = (lines) => {
    let total = 0, unpriced = 0;
    for (const l of lines) {
      const dc = deck.cards.find(c => c.name === l.name && (c.board === 'main' || c.board === 'commander'));
      const p = dc ? builderPriceOf(deck, dc) : null;
      if (p == null) unpriced += l.qty; else total += p * l.qty;
    }
    return { total, unpriced };
  };

  showModal(`
    <h2>🛒 Buy / Export — ${esc(deck.name)}</h2>
    <div class="db-buy-opts">
      <label><input type="radio" name="dbScope" value="all" ${opts.scope === 'all' ? 'checked' : ''}> Whole deck</label>
      <label><input type="radio" name="dbScope" value="missing" ${opts.scope === 'missing' ? 'checked' : ''}> Only cards I don’t own</label>
      <label style="margin-left:auto"><input type="checkbox" id="dbSkipBasics" checked> Skip basic lands</label>
    </div>
    <div class="db-buy-opts">
      <label><input type="radio" name="dbVendor" value="tcgplayer" checked> TCGplayer</label>
      <label><input type="radio" name="dbVendor" value="cardkingdom"> Card Kingdom</label>
      <span id="dbBuySummary" style="margin-left:auto;color:var(--text-dim);font-size:12px"></span>
    </div>
    <textarea id="dbBuyText" rows="12" readonly style="width:100%;font-family:monospace;font-size:12px;resize:vertical"></textarea>
    <div style="font-size:11.5px;color:var(--text-muted);margin:6px 0 14px;line-height:1.5" id="dbBuyHelp"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" id="dbBuyOpen"></button>
      <button class="btn" id="dbBuyCopy">📋 Copy list</button>
      <button class="btn" id="dbBuySave">⤓ Save .txt</button>
      <span style="flex:1"></span>
      <button class="btn btn-ghost" id="dbBuyOther" title="Moxfield, Archidekt, ManaBox, MTG Arena, CSV">Other formats…</button>
    </div>`, 'wide');

  const $ = id => document.getElementById(id);
  const refresh = () => {
    const lines = linesNow();
    const cards = lines.reduce((s, l) => s + l.qty, 0);
    const est = estimate(lines);
    $('dbBuyText').value = formatVendorList(lines, opts.vendor);
    $('dbBuySummary').textContent = `${cards} card${cards !== 1 ? 's' : ''} · ~${fmt(est.total)}${est.unpriced ? ` (+${est.unpriced} unpriced)` : ''}`;
    const tcg = opts.vendor === 'tcgplayer';
    $('dbBuyOpen').textContent = tcg ? '🛒 Open in TCGplayer Mass Entry' : '🛒 Copy & open Card Kingdom Deck Builder';
    $('dbBuyHelp').textContent = tcg
      ? 'Mass Entry opens with the list filled in — use TCGplayer’s Optimize to get the cheapest sellers.'
      : 'The list is copied to your clipboard — paste it into Card Kingdom’s Deck Builder box and click “Add to cart”.';
    $('dbBuyOpen').disabled = !lines.length;
  };
  document.querySelectorAll('input[name="dbScope"]').forEach(r => r.addEventListener('change', () => { opts.scope = r.value; refresh(); }));
  document.querySelectorAll('input[name="dbVendor"]').forEach(r => r.addEventListener('change', () => { opts.vendor = r.value; refresh(); }));
  $('dbSkipBasics').addEventListener('change', e => { opts.skipBasics = e.target.checked; refresh(); });
  $('dbBuyOpen').addEventListener('click', () => {
    const lines = linesNow();
    if (opts.vendor === 'tcgplayer') {
      window.api.app.openExternal(tcgMassEntryUrl(lines));
      toast(`Opening ${lines.length} card${lines.length !== 1 ? 's' : ''} on TCGplayer…`, 'info');
    } else {
      copyToClipboard(formatVendorList(lines, 'cardkingdom'), 'Card Kingdom list');
      window.api.app.openExternal(CARD_KINGDOM_BUILDER_URL);
    }
  });
  $('dbBuyCopy').addEventListener('click', () => copyToClipboard($('dbBuyText').value, 'Card list'));
  $('dbBuySave').addEventListener('click', async () => {
    const safe = deck.name.replace(/[^\w\- ]+/g, '').trim() || 'deck';
    const p = await window.api.dialog.saveFile({
      title: 'Save card list', defaultPath: `${safe} - ${opts.vendor === 'tcgplayer' ? 'TCGplayer' : 'Card Kingdom'}.txt`,
      filterName: 'Text files', extensions: ['txt'], content: $('dbBuyText').value + '\n',
    });
    if (p) toast(`Saved to ${p}`, 'success');
  });
  $('dbBuyOther').addEventListener('click', () => showDeckExportModal(deck.id));
  refresh();
}
