// Throwaway DB round-trip test for the decks tables.
// Run with Electron's Node ABI: $env:ELECTRON_RUN_AS_NODE=1; npx electron scripts/smoke-decks-db.js
'use strict';
const db = require('../src/main/db.js');
const os = require('os');
const fs = require('fs');
const path = require('path');

const p = path.join(os.tmpdir(), `slt-deck-test-${Date.now()}.db`);
db.init(p);

let failures = 0;
const check = (label, cond, detail) => {
  if (cond) console.log(`  ok  ${label}`);
  else { failures++; console.error(`FAIL  ${label} — ${JSON.stringify(detail)}`); }
};

db.upsertDeck({
  id: 'd1', name: 'Test Deck', format: 'commander', description: 'desc',
  cards: [
    { id: 'dc1', cardId: 'c9', scryfallId: 'abc', name: 'Sol Ring', setCode: 'c21', setName: 'Commander 2021', collectorNumber: '263', foil: 'normal', quantity: 1, board: 'main' },
    { id: 'dc2', cardId: null, scryfallId: 'def', name: 'Krenko, Mob Boss', setCode: 'ddt', setName: '', collectorNumber: '46', foil: 'foil', quantity: 1, board: 'commander' },
  ],
});

let decks = db.listDecks();
check('one deck listed', decks.length === 1, decks);
check('deck fields round-trip', decks[0].name === 'Test Deck' && decks[0].format === 'commander' && decks[0].description === 'desc', decks[0]);
check('two cards round-trip', decks[0].cards.length === 2, decks[0].cards);
const dc1 = decks[0].cards.find(c => c.id === 'dc1');
const dc2 = decks[0].cards.find(c => c.id === 'dc2');
check('card link fields', dc1.cardId === 'c9' && dc1.scryfallId === 'abc' && dc1.board === 'main', dc1);
check('unowned commander entry', dc2.cardId === null && dc2.board === 'commander' && dc2.foil === 'foil', dc2);

// Rewrite-on-upsert (card list replaced, not appended)
db.upsertDeck({ id: 'd1', name: 'Renamed', format: 'modern', cards: [{ id: 'dc3', name: 'Bolt', quantity: 4, board: 'main' }] });
decks = db.listDecks();
check('upsert replaces card list', decks[0].cards.length === 1 && decks[0].cards[0].name === 'Bolt', decks[0].cards);
check('upsert updates deck row', decks[0].name === 'Renamed' && decks[0].format === 'modern', decks[0]);

// Deck Builder: builder settings + per-card role overrides round-trip
db.upsertDeck({ id: 'd1', name: 'Builder', format: 'commander',
  builder: { budget: 75, budgetMode: 'missing', roleTargets: { land: 36 }, customRoles: [{ id: 'c_x', label: 'Tokens', target: 5 }] },
  cards: [{ id: 'dc4', name: 'Sol Ring', quantity: 1, board: 'main', roles: ['ramp', 'c_x'] }, { id: 'dc5', name: 'Forest', quantity: 30, board: 'main' }] });
decks = db.listDecks();
check('builder settings round-trip', decks[0].builder?.budget === 75 && decks[0].builder.budgetMode === 'missing'
  && decks[0].builder.roleTargets.land === 36 && decks[0].builder.customRoles[0].label === 'Tokens', decks[0].builder);
check('card roles round-trip', JSON.stringify(decks[0].cards.find(c => c.id === 'dc4').roles) === '["ramp","c_x"]', decks[0].cards);
check('no roles key when unset', !('roles' in decks[0].cards.find(c => c.id === 'dc5')), decks[0].cards);
db.upsertDeck({ id: 'd1', name: 'Plain', format: 'commander', cards: [] });
check('plain deck has null builder', db.listDecks()[0].builder === null, db.listDecks()[0]);

// Commander legality on metadata; a later write without it must not erase it
db.bulkUpsertMetadata([{ scryfallId: 'm1', colors: [], color_identity: [], type_line: 'Artifact', cmc: 1, legal_commander: 'banned', game_changer: true }]);
db.bulkUpsertMetadata([{ scryfallId: 'm1', colors: [], color_identity: [], type_line: 'Artifact', cmc: 1 }]);
const m1 = db.getAllMetadata().m1;
check('metadata keeps legal_commander + game_changer', m1.legal_commander === 'banned' && m1.game_changer === true, m1);

// Cascade delete
db.deleteDeck('d1');
check('deck deleted', db.listDecks().length === 0);

// resetAll includes decks
db.upsertDeck({ id: 'd2', name: 'X', format: 'other', cards: [{ id: 'dc9', name: 'Y', quantity: 1, board: 'main' }] });
db.resetAll();
check('resetAll clears decks', db.listDecks().length === 0);

try { fs.unlinkSync(p); } catch {}
console.log(failures ? `\n${failures} FAILURES` : '\nAll DB smoke tests passed.');
process.exit(failures ? 1 : 0);
