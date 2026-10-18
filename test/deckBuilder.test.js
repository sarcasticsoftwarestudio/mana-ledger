import { describe, it, expect } from 'vitest';
import {
  budgetSummary, classifyRoles, commanderEligibility, copyLimitFor, formatVendorList, partnerQuery,
  roleSummary, scryfallBuilderQuery, tcgMassEntryUrl, validCommanderPair, validateCommanderDeck, vendorLines,
} from '../src/renderer-js/deckBuilderCore.js';

// ── fixtures ────────────────────────────────────────────────────────────────
const META = {
  meren:   { type_line: 'Legendary Creature — Human Shaman', oracle_text: 'At the beginning of your end step, choose target creature card in your graveyard.', color_identity: ['B', 'G'], cmc: 4, legal_commander: 'legal' },
  sol:     { type_line: 'Artifact', oracle_text: '{T}: Add {C}{C}.', color_identity: [], cmc: 1, legal_commander: 'legal' },
  forest:  { type_line: 'Basic Land — Forest', oracle_text: '({T}: Add {G}.)', color_identity: ['G'], cmc: 0, legal_commander: 'legal' },
  bolt:    { type_line: 'Instant', oracle_text: 'Lightning Bolt deals 3 damage to any target.', color_identity: ['R'], cmc: 1, legal_commander: 'legal' },
  doom:    { type_line: 'Instant', oracle_text: 'Destroy target nonblack creature.', color_identity: ['B'], cmc: 2, legal_commander: 'legal' },
  harmon:  { type_line: 'Sorcery', oracle_text: 'Draw two cards.', color_identity: ['G'], cmc: 3, legal_commander: 'legal' },
  rats:    { type_line: 'Creature — Rat', oracle_text: 'A deck can have any number of cards named Relentless Rats.', color_identity: ['B'], cmc: 3, legal_commander: 'legal' },
  dwarf:   { type_line: 'Creature — Dwarf', oracle_text: 'A deck can have up to seven cards named Seven Dwarves.', color_identity: ['R'], cmc: 2, legal_commander: 'legal' },
  rings:   { type_line: 'Artifact', oracle_text: '{T}: Add {C}.', color_identity: [], cmc: 3, legal_commander: 'banned' },
  bear:    { type_line: 'Creature — Bear', oracle_text: '', color_identity: ['G'], cmc: 2, legal_commander: 'legal' },
  thrasios:{ type_line: 'Legendary Creature — Merfolk Wizard', oracle_text: '{4}: Scry 1, then reveal the top card.\nPartner (You can have two commanders if both have partner.)', color_identity: ['G', 'U'], cmc: 2, legal_commander: 'legal' },
  tymna:   { type_line: 'Legendary Creature — Human Cleric', oracle_text: 'Lifelink\nPartner (You can have two commanders if both have partner.)', color_identity: ['W', 'B'], cmc: 3, legal_commander: 'legal' },
  wilson:  { type_line: 'Legendary Creature — Bear Warrior', oracle_text: 'Choose a Background (You can have a Background as a second commander.)', color_identity: ['G'], cmc: 2, legal_commander: 'legal' },
  bg:      { type_line: 'Legendary Enchantment — Background', oracle_text: 'Commander creatures you own have menace.', color_identity: ['B'], cmc: 2, legal_commander: 'legal' },
  pir:     { type_line: 'Legendary Creature — Human Wizard', oracle_text: 'Partner with Toothy, Imaginary Friend (When this creature enters, target player may put Toothy into their hand from their library, then shuffle.)', color_identity: ['U'], cmc: 2, legal_commander: 'legal' },
  toothy:  { type_line: 'Legendary Creature — Illusion', oracle_text: 'Partner with Pir, Imaginative Rascal (When this creature enters, target player may put Pir into their hand.)', color_identity: ['U'], cmc: 4, legal_commander: 'legal' },
  teferi:  { type_line: 'Legendary Planeswalker — Teferi', oracle_text: 'Teferi, Temporal Archmage can be your commander.', color_identity: ['U'], cmc: 6, legal_commander: 'legal' },
};
const metaFn = (sid) => META[sid] || null;

let n = 0;
const card = (sid, name, board = 'main', quantity = 1, extra = {}) => ({ id: `e${n++}`, scryfallId: sid, name, board, quantity, ...extra });

// A legal 100-card Meren deck: commander + Sol Ring + Harmonize + Doom Blade + 96 Forests.
function legalDeck() {
  return { format: 'commander', cards: [
    card('meren', 'Meren of Clan Nel Toth', 'commander'),
    card('sol', 'Sol Ring'), card('harmon', 'Harmonize'), card('doom', 'Doom Blade'),
    card('forest', 'Forest', 'main', 96),
  ] };
}
const codes = (deck) => validateCommanderDeck(deck, metaFn).filter(i => i.level === 'error').map(i => i.code);

describe('validateCommanderDeck', () => {
  it('passes a legal 100-card deck', () => {
    expect(validateCommanderDeck(legalDeck(), metaFn)).toEqual([]);
  });
  it('requires a commander', () => {
    const d = legalDeck(); d.cards[0].board = 'main';
    expect(codes(d)).toContain('no-commander');
  });
  it('requires exactly 100 cards', () => {
    const d = legalDeck(); d.cards[4].quantity = 90;
    expect(validateCommanderDeck(d, metaFn).find(i => i.code === 'size').msg).toMatch(/94\/100.*add 6/);
    d.cards[4].quantity = 100;
    expect(validateCommanderDeck(d, metaFn).find(i => i.code === 'size').msg).toMatch(/cut 4/);
  });
  it('enforces singleton but exempts basics and "any number" cards', () => {
    const d = legalDeck(); d.cards[4].quantity = 94; d.cards.push(card('sol', 'Sol Ring'));
    expect(codes(d)).toContain('singleton');
    const r = legalDeck(); r.cards[4].quantity = 66; r.cards.push(card('rats', 'Relentless Rats', 'main', 30));
    expect(codes(r)).not.toContain('singleton');
  });
  it('honours "up to seven" limits', () => {
    expect(copyLimitFor('Seven Dwarves', META.dwarf)).toBe(7);
    expect(copyLimitFor('Relentless Rats', META.rats)).toBe(Infinity);
    expect(copyLimitFor('Forest', META.forest)).toBe(Infinity);
    expect(copyLimitFor('Sol Ring', META.sol)).toBe(1);
  });
  it('flags cards outside the commander color identity', () => {
    const d = legalDeck(); d.cards[4].quantity = 95; d.cards.push(card('bolt', 'Lightning Bolt'));
    const issue = validateCommanderDeck(d, metaFn).find(i => i.code === 'color-identity');
    expect(issue.msg).toMatch(/Lightning Bolt/);
  });
  it('flags banned cards', () => {
    const d = legalDeck(); d.cards[4].quantity = 95; d.cards.push(card('rings', 'Sol Ringer'));
    expect(codes(d)).toContain('banned');
  });
  it('rejects a sideboard', () => {
    const d = legalDeck(); d.cards.push(card('bear', 'Grizzly Bears', 'side'));
    expect(codes(d)).toContain('sideboard');
  });
  it('ignores the maybeboard', () => {
    const d = legalDeck(); d.cards.push(card('bolt', 'Lightning Bolt', 'maybe'));
    expect(validateCommanderDeck(d, metaFn)).toEqual([]);
  });
  it('rejects a non-legendary commander', () => {
    const d = legalDeck(); d.cards[0] = card('bear', 'Grizzly Bears', 'commander');
    expect(codes(d)).toContain('commander-ineligible');
  });
  it('warns (not errors) when card data is missing', () => {
    const d = legalDeck(); d.cards[1].scryfallId = 'unknown';
    const issues = validateCommanderDeck(d, metaFn);
    expect(issues.filter(i => i.level === 'error')).toEqual([]);
    expect(issues.map(i => i.code)).toContain('unverified');
  });
  it('accepts valid partners and rejects invalid pairs', () => {
    const d = legalDeck();
    d.cards[0] = card('thrasios', 'Thrasios, Triton Hero', 'commander');
    d.cards.push(card('tymna', 'Tymna the Weaver', 'commander'));
    d.cards[4].quantity = 95;
    expect(codes(d)).not.toContain('commander-pair');
    d.cards[d.cards.length - 1] = card('meren', 'Meren of Clan Nel Toth', 'commander');
    expect(codes(d)).toContain('commander-pair');
  });
});

describe('commander eligibility & pairing', () => {
  it('allows "can be your commander" planeswalkers', () => {
    expect(commanderEligibility(META.teferi).ok).toBe(true);
    expect(commanderEligibility(META.bear).ok).toBe(false);
  });
  it('pairs Choose a Background with a Background', () => {
    expect(validCommanderPair({ name: 'Wilson', meta: META.wilson }, { name: 'Bg', meta: META.bg }).ok).toBe(true);
  });
  it('pairs "Partner with" only with the named card', () => {
    expect(validCommanderPair({ name: 'Pir, Imaginative Rascal', meta: META.pir }, { name: 'Toothy, Imaginary Friend', meta: META.toothy }).ok).toBe(true);
    expect(validCommanderPair({ name: 'Pir, Imaginative Rascal', meta: META.pir }, { name: 'Thrasios, Triton Hero', meta: META.thrasios }).ok).toBe(false);
  });
  it('builds partner search queries', () => {
    expect(partnerQuery('Thrasios', META.thrasios).text).toMatch(/keyword:partner/);
    expect(partnerQuery('Pir', META.pir).text).toBe('!"Toothy, Imaginary Friend"');
    expect(partnerQuery('Wilson', META.wilson)).toEqual({ text: 't:background', commander: false });
    expect(partnerQuery('Meren', META.meren)).toBeNull();
  });
});

describe('roles', () => {
  it('classifies common card types', () => {
    expect(classifyRoles(META.forest)).toEqual(['land']);
    expect(classifyRoles(META.sol)[0]).toBe('ramp');
    expect(classifyRoles(META.harmon)[0]).toBe('draw');
    expect(classifyRoles(META.doom)[0]).toBe('removal');
    expect(classifyRoles({ type_line: 'Sorcery', oracle_text: 'Destroy all creatures. They can’t be regenerated.' })[0]).toBe('wipe');
    expect(classifyRoles(META.bear)).toEqual(['synergy']);
  });
  it('groups by primary role, counts every role, honours overrides', () => {
    const d = legalDeck();
    d.cards.push(card('bear', 'Grizzly Bears', 'main', 1, { roles: ['wincon', 'draw'] }));
    const g = Object.fromEntries(roleSummary(d, metaFn).map(x => [x.id, x]));
    expect(g.land.count).toBe(96);
    expect(g.ramp.cards.map(c => c.name)).toEqual(['Sol Ring']);
    expect(g.wincon.cards.map(c => c.name)).toEqual(['Grizzly Bears']);
    expect(g.draw.count).toBe(2);           // Harmonize + the bear's secondary role
    expect(g.land.target).toBe(37);
  });
  it('applies per-deck role targets and custom roles', () => {
    const d = legalDeck();
    d.builder = { roleTargets: { land: 35 }, customRoles: [{ id: 'c_tok', label: 'Tokens', target: 6 }] };
    d.cards.push(card('bear', 'Grizzly Bears', 'main', 1, { roles: ['c_tok'] }));
    const g = Object.fromEntries(roleSummary(d, metaFn).map(x => [x.id, x]));
    expect(g.land.target).toBe(35);
    expect(g.c_tok.count).toBe(1);
  });
});

describe('budget', () => {
  const prices = { 'Sol Ring': 1.5, Harmonize: 0.5, 'Doom Blade': 0.25, Forest: 0.1, 'Meren of Clan Nel Toth': 2 };
  const priceOf = dc => prices[dc.name] ?? null;
  it('totals the whole deck against the budget', () => {
    const d = legalDeck(); d.builder = { budget: 10 };
    const b = budgetSummary(d, { priceOf });
    expect(b.spent).toBe(13.85);
    expect(b.over).toBe(true);
    expect(b.remaining).toBe(-3.85);
  });
  it('counts only what you still need in "missing" mode', () => {
    const d = legalDeck(); d.builder = { budget: 10, budgetMode: 'missing' };
    const owned = dc => (dc.name === 'Forest' ? 200 : dc.name === 'Sol Ring' ? 1 : 0);
    const b = budgetSummary(d, { priceOf, ownedQty: owned });
    expect(b.spent).toBe(2.75);
    expect(b.over).toBe(false);
  });
  it('reports unpriced cards instead of treating them as free', () => {
    const d = legalDeck(); d.cards.push(card('bear', 'Grizzly Bears'));
    expect(budgetSummary(d, { priceOf }).unpriced).toBe(1);
  });
});

describe('vendor export', () => {
  const d = { cards: [
    card('x', 'Delver of Secrets // Insectile Aberration'), card('sol', 'Sol Ring'),
    card('forest', 'Forest', 'main', 30), card('bear', 'Grizzly Bears', 'maybe'),
  ] };
  it('merges by name, skips maybeboard, optionally skips basics', () => {
    expect(vendorLines(d).map(l => l.name)).toEqual(['Delver of Secrets // Insectile Aberration', 'Forest', 'Sol Ring']);
    expect(vendorLines(d, { skipBasics: true }).map(l => l.name)).not.toContain('Forest');
  });
  it('exports only missing copies', () => {
    const lines = vendorLines(d, { scope: 'missing', ownedQty: dc => (dc.name === 'Forest' ? 20 : dc.name === 'Sol Ring' ? 1 : 0) });
    expect(lines).toEqual([{ name: 'Delver of Secrets // Insectile Aberration', qty: 1 }, { name: 'Forest', qty: 10 }]);
  });
  it('formats per vendor', () => {
    const lines = vendorLines(d, { skipBasics: true });
    expect(formatVendorList(lines, 'cardkingdom')).toBe('1 Delver of Secrets\n1 Sol Ring');
    expect(formatVendorList(lines, 'tcgplayer')).toBe('1 Delver of Secrets // Insectile Aberration\n1 Sol Ring');
    expect(decodeURIComponent(tcgMassEntryUrl(lines))).toContain('c=1 Delver of Secrets // Insectile Aberration||1 Sol Ring');
  });
});

describe('scryfallBuilderQuery', () => {
  it('constrains to identity, legality, role and price', () => {
    expect(scryfallBuilderQuery({ text: 'elf', identity: ['B', 'G'], role: 'ramp', maxPrice: 2 }))
      .toBe('elf legal:commander id<=bg otag:ramp usd<=2.00 prefer:usd-low');
  });
  it('handles colorless identity and commander search', () => {
    expect(scryfallBuilderQuery({ identity: [] })).toBe('legal:commander id:c prefer:usd-low');
    expect(scryfallBuilderQuery({ commander: true })).toBe('legal:commander is:commander prefer:usd-low');
  });
});
