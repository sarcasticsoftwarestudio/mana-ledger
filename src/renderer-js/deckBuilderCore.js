// ─────────────────────────────────────────────────────────────────────────────
// DECK BUILDER CORE — pure Commander rules, role grouping, budget math and
// vendor export formatting. No DOM, no app state: every function takes the
// deck plus lookup callbacks, so it's unit-tested directly (test/deckBuilder*).
//
// Card metadata (`meta`) is the shape kept in collection.cardMetadata:
//   { type_line, oracle_text, color_identity, cmc, legal_commander, game_changer }
// `legal_commander` is Scryfall's legalities.commander ('legal' | 'banned' |
// 'not_legal'); undefined means "not fetched yet" and is reported, not guessed.
// ─────────────────────────────────────────────────────────────────────────────

export const BASIC_LAND_NAMES = new Set([
  'plains', 'island', 'swamp', 'mountain', 'forest', 'wastes',
  'snow-covered plains', 'snow-covered island', 'snow-covered swamp',
  'snow-covered mountain', 'snow-covered forest', 'snow-covered wastes',
]);

export const COMMANDER_DECK_SIZE = 100;

// ── Roles ────────────────────────────────────────────────────────────────────
// Default targets follow the common "Command Zone" template (37 lands, ~10
// ramp, ~10 draw, ~8 removal, ~3 wipes). Every target is editable per deck;
// null = no target, the group just collects cards.
export const DEFAULT_ROLES = [
  { id: 'land',       label: 'Lands',           icon: '⛰', target: 37 },
  { id: 'ramp',       label: 'Ramp',            icon: '⚡', target: 10 },
  { id: 'draw',       label: 'Card Draw',       icon: '✋', target: 10 },
  { id: 'removal',    label: 'Removal',         icon: '🎯', target: 8 },
  { id: 'wipe',       label: 'Board Wipes',     icon: '💥', target: 3 },
  { id: 'protection', label: 'Protection',      icon: '🛡', target: null },
  { id: 'wincon',     label: 'Win Conditions',  icon: '🏆', target: null },
  { id: 'synergy',    label: 'Synergy / Theme', icon: '✦', target: null },
];
export const FALLBACK_ROLE = 'synergy';

// Scryfall search fragments for the role filter chips (Scryfall "oracle tags"
// are community-maintained functional tags — far better than text matching).
export const ROLE_QUERIES = {
  land: 't:land',
  ramp: 'otag:ramp',
  draw: 'otag:draw',
  removal: 'otag:removal',
  wipe: 'otag:board-wipe',
  protection: '(o:hexproof or o:indestructible or o:"phase out" or o:shroud)',
  wincon: '(o:"win the game" or o:"loses the game")',
};

export function builderSettings(deck) {
  const b = deck?.builder || {};
  return {
    budget: Number.isFinite(b.budget) && b.budget > 0 ? b.budget : null,
    budgetMode: b.budgetMode === 'missing' ? 'missing' : 'total',
    priceMode: b.priceMode === 'printing' ? 'printing' : 'cheapest',
    roleTargets: b.roleTargets || {},
    customRoles: Array.isArray(b.customRoles) ? b.customRoles : [],
  };
}

// The deck's role list: defaults (with per-deck target overrides) followed by
// any custom roles the user added. Custom roles are { id, label, target }.
export function deckRoles(deck) {
  const s = builderSettings(deck);
  const pick = (id, fallback) => (id in s.roleTargets ? s.roleTargets[id] : fallback);
  return [
    ...DEFAULT_ROLES.map(r => ({ ...r, target: pick(r.id, r.target) })),
    ...s.customRoles.map(r => ({ id: r.id, label: r.label, icon: '◆', target: pick(r.id, r.target ?? null), custom: true })),
  ];
}

const frontFace = (s) => String(s || '').split(' // ')[0];
const stripReminder = (s) => String(s || '').replace(/\([^)]*\)/g, '');

// Heuristic first-pass role tagging from type line + oracle text. Returns role
// ids, most specific first; the first entry is the card's group. Users can
// override any card — this only has to be a good starting point.
export function classifyRoles(meta) {
  if (!meta) return [FALLBACK_ROLE];
  const type = frontFace(meta.type_line).toLowerCase();
  const o = stripReminder(meta.oracle_text).toLowerCase();
  if (/\bland\b/.test(type) && !/\bcreature\b/.test(type)) return ['land'];

  const roles = [];
  const add = (r) => { if (!roles.includes(r)) roles.push(r); };

  if (/\badd \{|\badd (one|two|three|x|that much) mana|mana of any (one )?(color|type)/.test(o)
   || /search your library for [^.]*\bland[^.]*onto the battlefield/.test(o)
   || /put [^.]*\bland cards? [^.]*onto the battlefield/.test(o)
   || /create[^.]*\btreasure/.test(o)
   || /play an additional land|play (two|three) additional lands/.test(o)) add('ramp');

  if (/(destroy|exile) (all|each) (other )?(creatures?|nonland permanents?|permanents?|artifacts?|enchantments?|planeswalkers?)/.test(o)
   || /damage to each (creature|other creature)/.test(o)
   || /all (other )?creatures get -/.test(o)
   || /return all (nonland permanents|creatures|other creatures)[^.]*owners'? hands?/.test(o)
   || /each player sacrifices (all|that many|[a-z]+ creatures)/.test(o)) add('wipe');

  if (/(destroy|exile) (up to (one|two|three) )?target/.test(o)
   || /counter target/.test(o)
   || /deals? (\d+|x|that much) damage to (any target|target (creature|planeswalker|attacking|blocking|player or planeswalker))/.test(o)
   || /target creature (an opponent controls )?gets -\d|target creature gets -x/.test(o)
   || /return (up to one )?target (nonland |creature |artifact |enchantment |)?(permanent|creature|artifact|enchantment)[^.]*to its owner's hand/.test(o)
   || /fights? (up to one )?(another )?target/.test(o)
   || /target (player|opponent) sacrifices/.test(o)) add('removal');

  if (/\bdraws? (a|an additional|one|two|three|four|five|seven|x|that many) cards?\b/.test(o)
   || /\bdraw cards\b/.test(o)
   || /exile the top [^.]*\. (until [^.]*, )?you may (play|cast)/.test(o)) add('draw');

  if (/(creatures|permanents|commanders?) you control (gain|have)[^.]*(hexproof|indestructible|shroud|protection)/.test(o)
   || /target [^.]*(gains?|has) (hexproof|indestructible|shroud|protection)/.test(o)
   || /phases? out/.test(o)) add('protection');

  if (/you win the game|loses the game/.test(o)) add('wincon');

  return roles.length ? roles : [FALLBACK_ROLE];
}

// A deck entry's roles: explicit overrides win, else the classifier.
export function cardRoles(dc, meta) {
  if (Array.isArray(dc.roles) && dc.roles.length) return dc.roles;
  return classifyRoles(meta);
}

// Groups the 99 (commanders excluded) by primary role, and counts every card
// toward each role it fills (a card can be ramp AND draw). Roles that no
// longer exist (a deleted custom role) fall back to the catch-all group.
export function roleSummary(deck, metaFn) {
  const roles = deckRoles(deck);
  const ids = new Set(roles.map(r => r.id));
  const groups = new Map(roles.map(r => [r.id, { ...r, count: 0, cards: [] }]));
  for (const dc of deck.cards || []) {
    if ((dc.board || 'main') !== 'main') continue;
    const qty = dc.quantity || 1;
    const rs = cardRoles(dc, dc.scryfallId ? metaFn(dc.scryfallId) : null).filter(r => ids.has(r));
    const primary = rs[0] || FALLBACK_ROLE;
    groups.get(primary).cards.push(dc);
    for (const r of new Set(rs.length ? rs : [FALLBACK_ROLE])) groups.get(r).count += qty;
  }
  return [...groups.values()];
}

// ── Commander eligibility & pairing ─────────────────────────────────────────
export function commanderEligibility(meta) {
  if (!meta) return { ok: null, reason: 'card data not loaded yet' };
  const type = frontFace(meta.type_line);
  const o = meta.oracle_text || '';
  if (/\bLegendary\b/.test(type) && /\bCreature\b/.test(type)) return { ok: true };
  if (/can be your commander/i.test(o)) return { ok: true };
  if (/\bLegendary\b/.test(type) && /\bBackground\b/.test(type)) {
    return { ok: true, backgroundOnly: true };
  }
  return { ok: false, reason: 'only legendary creatures (or cards that say they “can be your commander”) can lead a deck' };
}

// What kind of second-commander ability a card has, read from oracle text.
export function partnerInfo(name, meta) {
  const o = meta?.oracle_text || '';
  const type = frontFace(meta?.type_line);
  const withM = o.match(/Partner with ([^\n(]+)/);
  if (withM) return { kind: 'with', with: withM[1].trim().replace(/[.\s]+$/, '') };
  const varM = o.match(/Partner\s*[—–-]\s*([^\n(]+)/);
  if (varM) return { kind: 'variant', variant: varM[1].trim().toLowerCase() };
  if (/Friends forever/i.test(o)) return { kind: 'variant', variant: 'friends forever' };
  if (/(^|\n|,\s*)Partner\b(?! with)/i.test(o)) return { kind: 'partner' };
  if (/Choose a Background/i.test(o)) return { kind: 'chooser' };
  if (/\bBackground\b/.test(type)) return { kind: 'background' };
  if (/Doctor['’]s companion/i.test(o)) return { kind: 'companion' };
  if (/\bTime Lord\b/.test(type) && /\bDoctor\b/.test(type)) return { kind: 'doctor' };
  return { kind: null };
}

const sameName = (a, b) => frontFace(a).trim().toLowerCase() === frontFace(b).trim().toLowerCase();

export function validCommanderPair(a, b) {
  const pa = partnerInfo(a.name, a.meta), pb = partnerInfo(b.name, b.meta);
  const kinds = [pa.kind, pb.kind].sort().join('+');
  if (pa.kind === 'partner' && pb.kind === 'partner') return { ok: true };
  if (pa.kind === 'with' && pb.kind === 'with' && sameName(pa.with, b.name) && sameName(pb.with, a.name)) return { ok: true };
  if (pa.kind === 'variant' && pb.kind === 'variant' && pa.variant === pb.variant) return { ok: true };
  if (kinds === 'background+chooser') return { ok: true };
  if (kinds === 'companion+doctor') return { ok: true };
  if (pa.kind === 'with' || pb.kind === 'with') {
    const p = pa.kind === 'with' ? pa : pb;
    return { ok: false, reason: `“Partner with” only pairs with the named card (${p.with})` };
  }
  if (!pa.kind || !pb.kind) {
    const lone = !pa.kind ? a.name : b.name;
    return { ok: false, reason: `${lone} has no partner ability (Partner, Friends forever, Choose a Background, Doctor's companion)` };
  }
  return { ok: false, reason: 'their partner abilities don’t match' };
}

// Scryfall search for the cards that can legally pair with `commander`, or
// null when it has no partner-style ability.
export function partnerQuery(name, meta) {
  const p = partnerInfo(name, meta);
  switch (p.kind) {
    case 'partner':   return { text: 'keyword:partner -o:"partner with"', commander: true };
    case 'with':      return { text: `!"${p.with}"`, commander: true };
    case 'variant':   return { text: `o:"${p.variant === 'friends forever' ? 'Friends forever' : `Partner—${p.variant}`}"`, commander: true };
    case 'chooser':   return { text: 't:background', commander: false };
    case 'background': return { text: 'o:"Choose a Background"', commander: true };
    case 'companion': return { text: 't:"time lord" t:doctor', commander: true };
    case 'doctor':    return { text: 'o:"Doctor\'s companion"', commander: true };
    default:          return null;
  }
}

// ── Copy limits ──────────────────────────────────────────────────────────────
const NUMBER_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function copyLimitFor(name, meta) {
  if (BASIC_LAND_NAMES.has(String(name || '').toLowerCase())) return Infinity;
  const o = meta?.oracle_text || '';
  if (/A deck can have any number of cards named/i.test(o)) return Infinity;
  const m = o.match(/A deck can have up to (\w+) cards named/i);
  if (m) return NUMBER_WORDS[m[1].toLowerCase()] || parseInt(m[1]) || 1;
  return 1;
}

// ── Full Commander validation ───────────────────────────────────────────────
// Returns [{ level: 'error'|'warn', code, msg }]. Enforces: deck size (exactly
// 100 incl. commanders), commander count/eligibility/pairing, no sideboard,
// singleton (with basic-land and "any number"/"up to N" exemptions), color
// identity, and Scryfall's commander legality (banned / not legal).
export function validateCommanderDeck(deck, metaFn) {
  const issues = [];
  const err = (code, msg) => issues.push({ level: 'error', code, msg });
  const warn = (code, msg) => issues.push({ level: 'warn', code, msg });
  const cards = deck.cards || [];
  const qty = arr => arr.reduce((s, c) => s + (c.quantity || 1), 0);
  const meta = dc => (dc.scryfallId ? metaFn(dc.scryfallId) : null);
  const cmd = cards.filter(c => c.board === 'commander');
  const main = cards.filter(c => (c.board || 'main') === 'main');
  const side = cards.filter(c => c.board === 'side');
  const list = (names, n = 4) => names.slice(0, n).join(', ') + (names.length > n ? ` +${names.length - n} more` : '');

  // Commanders
  const nCmd = qty(cmd);
  if (nCmd === 0) err('no-commander', 'Choose a commander');
  else if (nCmd > 2) err('too-many-commanders', `Too many commanders (${nCmd}) — at most 2, and only with a partner ability`);
  else {
    for (const c of cmd) {
      if ((c.quantity || 1) > 1) err('commander-qty', `${c.name} is listed ${c.quantity}× as commander`);
      const el = commanderEligibility(meta(c));
      if (el.ok === false) err('commander-ineligible', `${c.name} can’t be your commander — ${el.reason}`);
      if (el.backgroundOnly && nCmd === 1) err('commander-ineligible', `${c.name} is a Background — it can only be paired with a “Choose a Background” commander`);
    }
    if (cmd.length === 2) {
      const [a, b] = cmd;
      if (meta(a) && meta(b)) {
        const pair = validCommanderPair({ name: a.name, meta: meta(a) }, { name: b.name, meta: meta(b) });
        if (!pair.ok) err('commander-pair', `${a.name} and ${b.name} can’t be co-commanders — ${pair.reason}`);
      }
    }
  }

  // Size & sideboard
  const size = qty(main) + nCmd;
  if (size < COMMANDER_DECK_SIZE) err('size', `${size}/100 cards — add ${COMMANDER_DECK_SIZE - size} more`);
  else if (size > COMMANDER_DECK_SIZE) err('size', `${size}/100 cards — cut ${size - COMMANDER_DECK_SIZE}`);
  if (qty(side)) err('sideboard', `Commander has no sideboard — ${qty(side)} card${qty(side) > 1 ? 's' : ''} there (move them to the maybeboard)`);

  // Singleton
  const byName = new Map();
  for (const dc of [...cmd, ...main]) {
    const k = String(dc.name || '').toLowerCase();
    const e = byName.get(k) || { name: dc.name, n: 0, meta: meta(dc) };
    e.n += dc.quantity || 1;
    e.meta = e.meta || meta(dc);
    byName.set(k, e);
  }
  for (const e of byName.values()) {
    const limit = copyLimitFor(e.name, e.meta);
    if (e.n > limit) err('singleton', `${e.n}× ${e.name} — ${limit === 1 ? 'singleton: only 1 copy allowed' : `at most ${limit} copies`}`);
  }

  // Color identity
  const cmdMeta = cmd.map(meta);
  if (cmd.length && cmdMeta.every(Boolean)) {
    const identity = new Set(cmdMeta.flatMap(m => m.color_identity || []));
    const off = main.filter(dc => meta(dc)?.color_identity?.some(c => !identity.has(c))).map(dc => dc.name);
    if (off.length) err('color-identity', `Outside your commander’s color identity (${[...identity].join('') || 'colorless'}): ${list(off)}`);
  }

  // Legality
  const banned = [], illegal = [];
  for (const dc of [...cmd, ...main]) {
    const l = meta(dc)?.legal_commander;
    if (l === 'banned') banned.push(dc.name);
    else if (l === 'not_legal') illegal.push(dc.name);
  }
  if (banned.length) err('banned', `Banned in Commander: ${list(banned)}`);
  if (illegal.length) err('not-legal', `Not legal in Commander: ${list(illegal)}`);

  // What we couldn't check
  const unknown = [...cmd, ...main].filter(dc => !meta(dc) || meta(dc).legal_commander == null);
  if (unknown.length) warn('unverified', `${unknown.length} card${unknown.length > 1 ? 's' : ''} not fully verified yet (card data still loading): ${list(unknown.map(d => d.name), 3)}`);

  return issues;
}

// ── Budget ───────────────────────────────────────────────────────────────────
// priceOf(dc) → unit price or null. ownedQty(dc) → copies owned. In
// 'missing' mode copies you already own cost nothing — the budget is what
// you'd spend to finish the deck. Maybeboard/sideboard never count.
export function budgetSummary(deck, { priceOf, ownedQty = () => 0 }) {
  const s = builderSettings(deck);
  let spent = 0, unpriced = 0, toBuy = 0;
  for (const dc of deck.cards || []) {
    const board = dc.board || 'main';
    if (board !== 'main' && board !== 'commander') continue;
    const q = dc.quantity || 1;
    const pay = s.budgetMode === 'missing' ? q - Math.min(q, ownedQty(dc)) : q;
    if (pay <= 0) continue;
    toBuy += pay;
    const p = priceOf(dc);
    if (p == null) { unpriced += pay; continue; }
    spent += p * pay;
  }
  spent = Math.round(spent * 100) / 100;
  const budget = s.budget;
  return {
    budget, mode: s.budgetMode, spent, unpriced, toBuy,
    remaining: budget != null ? Math.round((budget - spent) * 100) / 100 : null,
    over: budget != null && spent > budget + 0.004,
    pct: budget ? Math.min(999, (spent / budget) * 100) : null,
  };
}

// ── Vendor export ────────────────────────────────────────────────────────────
// One line per card name (printings merged): vendors resolve by name and pick
// the cheapest available copy, which is exactly what a budget build wants.
export function vendorLines(deck, { scope = 'all', skipBasics = false, ownedQty = () => 0 } = {}) {
  const map = new Map();
  for (const dc of deck.cards || []) {
    const board = dc.board || 'main';
    if (board !== 'main' && board !== 'commander') continue;
    if (skipBasics && BASIC_LAND_NAMES.has(String(dc.name).toLowerCase())) continue;
    const q = dc.quantity || 1;
    const need = scope === 'missing' ? q - Math.min(q, ownedQty(dc)) : q;
    if (need <= 0) continue;
    const k = dc.name.toLowerCase();
    const e = map.get(k) || { name: dc.name, qty: 0 };
    e.qty += need;
    map.set(k, e);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// TCGplayer lists double-faced cards under their full "A // B" name; Card
// Kingdom lists them under the front face.
export function vendorCardName(name, vendor) {
  return vendor === 'cardkingdom' ? frontFace(name).trim() : name;
}

export function formatVendorList(lines, vendor) {
  return lines.map(l => `${l.qty} ${vendorCardName(l.name, vendor)}`).join('\n');
}

export const CARD_KINGDOM_BUILDER_URL = 'https://www.cardkingdom.com/builder';

export function tcgMassEntryUrl(lines) {
  const c = lines.map(l => `${l.qty} ${vendorCardName(l.name, 'tcgplayer')}`).join('||');
  return `https://www.tcgplayer.com/massentry?productline=Magic&c=${encodeURIComponent(c)}`;
}

// ── Scryfall search query ────────────────────────────────────────────────────
// identity: array of WUBRG letters (empty = colorless commander), or null when
// no commander is chosen yet. prefer:usd-low makes each result the cheapest
// printing, so the price shown is the price a budget build would pay.
export function scryfallBuilderQuery({ text = '', identity = null, maxPrice = null, role = '', commander = false } = {}) {
  const parts = [];
  if (text.trim()) parts.push(text.trim());
  parts.push('legal:commander');
  if (commander) parts.push('is:commander');
  else if (identity) parts.push(identity.length ? `id<=${identity.join('').toLowerCase()}` : 'id:c');
  if (role && ROLE_QUERIES[role]) parts.push(ROLE_QUERIES[role]);
  if (maxPrice != null && Number.isFinite(maxPrice) && maxPrice >= 0) parts.push(`usd<=${maxPrice.toFixed(2)}`);
  parts.push('prefer:usd-low');
  return parts.join(' ');
}

export function commanderIdentity(deck, metaFn) {
  const cmd = (deck.cards || []).filter(c => c.board === 'commander');
  if (!cmd.length) return null;
  const metas = cmd.map(c => (c.scryfallId ? metaFn(c.scryfallId) : null));
  if (!metas.every(Boolean)) return null;
  const set = new Set(metas.flatMap(m => m.color_identity || []));
  return 'WUBRG'.split('').filter(c => set.has(c));
}
