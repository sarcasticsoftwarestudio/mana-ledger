// Fixed-content Secret Lair products that live outside Scryfall's normal SLD
// set and therefore cannot be discovered through the MTGJSON SLD product
// chain. Randomized galleries, promos and composite bundles live in
// slSupplemental.js instead; only true completion-checkable products belong
// here.

import { SL_COUNTDOWN_PRODUCTS } from './slCountdown.js';

const card = (scryfallId, name, number, finish) => ({
  mtgjsonUuid: null,
  identifiers: { scryfallId },
  scryfallId,
  name,
  number,
  finish,
  count: 1,
});

export const SL_ULTIMATE_PRODUCTS = [
  {
    uuid: 'special:slu:ultimate-edition',
    name: 'Secret Lair: Ultimate Edition',
    subtype: 'secret_lair_ultimate',
    identifiers: { scryfallSetCode: 'slu' },
    dropName: 'Secret Lair: Ultimate Edition',
    legacyDrop: 'Secret Lair: Ultimate Edition',
    finishLabel: 'Nonfoil',
    finish: 'nonfoil',
    tcgplayerProductId: null,
    releaseDate: '2020-06-12',
    msrp: null,
    sourceUrl: 'https://magic.wizards.com/en/news/announcements/making-fetch-happen-secret-lair-ultimate-edition-2020-03-13',
    sourceLabel: 'Official Wizards product + Scryfall SLU printings',
    lowConfidence: false,
    cards: [
      card('723a163e-97c1-4177-a067-873bebd9a87d', 'Marsh Flats', '1', 'nonfoil'),
      card('9f10f026-eba0-4e33-b465-f3a852402718', 'Scalding Tarn', '2', 'nonfoil'),
      card('397470c4-7f02-44ee-a18f-00bd950844d4', 'Verdant Catacombs', '3', 'nonfoil'),
      card('81ad48fa-9464-40bf-8bf5-af31a6a38fb3', 'Arid Mesa', '4', 'nonfoil'),
      card('8ed80db2-b30d-4306-8d9f-a43cd77d37e3', 'Misty Rainforest', '5', 'nonfoil'),
    ],
  },
  {
    uuid: 'special:slu:ultimate-edition-2',
    name: 'Secret Lair: Ultimate Edition 2',
    subtype: 'secret_lair_ultimate',
    identifiers: { scryfallSetCode: 'slu' },
    dropName: 'Secret Lair: Ultimate Edition 2',
    legacyDrop: 'Secret Lair: Ultimate Edition 2',
    finishLabel: 'Foil',
    finish: 'foil',
    tcgplayerProductId: null,
    releaseDate: '2021-05-07',
    msrp: null,
    sourceUrl: 'https://magic.wizards.com/en/news/announcements/announcing-secret-lair-ultimate-edition-2-2021-01-14',
    sourceLabel: 'Official Wizards product + Scryfall SLU printings',
    lowConfidence: false,
    cards: [
      card('79631e0a-b962-48f1-98fa-d871b2862866', 'Barkchannel Pathway // Tidechannel Pathway', '11', 'foil'),
      card('022c7fe3-45bb-4efe-9b0c-2e4807d607b8', 'Blightstep Pathway // Searstep Pathway', '12', 'foil'),
      card('5dfa0e82-da04-418b-9c60-038f3c2c31a5', 'Branchloft Pathway // Boulderloft Pathway', '13', 'foil'),
      card('1dce4e5a-08ab-4f52-bdfb-6d2dafbb055f', 'Brightclimb Pathway // Grimclimb Pathway', '14', 'foil'),
      card('94598167-dec4-425a-86bc-5989e2c3ba7c', 'Clearwater Pathway // Murkwater Pathway', '15', 'foil'),
      card('5e5288f2-b27e-4009-b537-d19f61b34c4a', 'Cragcrown Pathway // Timbercrown Pathway', '16', 'foil'),
      card('e3d06331-a819-40d8-a0b4-bbc97ba1f42c', 'Darkbore Pathway // Slitherbore Pathway', '17', 'foil'),
      card('8b13ff20-1dad-4c6a-979b-4d2662af5e74', 'Hengegate Pathway // Mistgate Pathway', '18', 'foil'),
      card('9102e1aa-7123-4c16-a810-d65b4505e147', 'Needleverge Pathway // Pillarverge Pathway', '19', 'foil'),
      card('13595b5d-5b78-4d63-89ae-02837693ba46', 'Riverglide Pathway // Lavaglide Pathway', '20', 'foil'),
    ],
  },
];

export const SL_SPECIAL_PRODUCTS = [...SL_COUNTDOWN_PRODUCTS, ...SL_ULTIMATE_PRODUCTS];

export function mergeSlSpecialProducts(model = {}) {
  const existing = Array.isArray(model.products) ? model.products : [];
  const specialIds = new Set(SL_SPECIAL_PRODUCTS.map(p => p.uuid));
  const products = [...existing.filter(p => !specialIds.has(p.uuid)), ...SL_SPECIAL_PRODUCTS];
  const scryfallToName = { ...(model.scryfallToName || {}) };
  for (const product of SL_SPECIAL_PRODUCTS) {
    for (const c of product.cards) {
      scryfallToName[c.scryfallId] = c.name;
      for (const id of (c.alternateScryfallIds || [])) scryfallToName[id] = c.name;
    }
  }
  return { ...model, products, scryfallToName };
}

export function slSpecialGroupFor(drop) {
  const product = SL_SPECIAL_PRODUCTS.find(p => p.legacyDrop === drop);
  return product ? { superdrop: product.legacyDrop, date: product.releaseDate.slice(0, 7) } : null;
}
