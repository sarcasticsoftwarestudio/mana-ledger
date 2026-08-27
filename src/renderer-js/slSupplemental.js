// Browsable Secret Lair material that is useful to collectors but is not a
// normal, fixed-content drop: SLP promos, SLD serialized promos, SLX related
// reprints, PSSC memorabilia, the pre-Secret-Lair Ponies precursor, and the
// composite bundle/Festival-in-a-Box catalog. These records are deliberately
// kept out of completion and drop P&L calculations.

import seed from './data/slSupplementalSeed.js';
import productSeed from './data/slProductSeed.js';
import { netFetch } from './utils.js';

const productSeedIds = new Set(Object.keys(productSeed.scryfallToName || {}));
const recentSldStart = (() => {
  const date = new Date(productSeed.generatedAt || Date.now());
  date.setUTCDate(date.getUTCDate() - 180);
  return date.toISOString().slice(0, 10);
})();
export const SL_RECENT_SLD_QUERY = `set:sld date>=${recentSldStart}`;

export const SL_SUPPLEMENTAL_SET_SPECS = [
  {
    code: 'slp', name: 'Secret Lair Promos', kind: 'promos', order: 1,
    description: 'Standalone Secret Lair prize, event, convention, purchase-threshold, and promotional cards. These are collectibles, not guaranteed drop contents.',
    sourceUrl: 'https://scryfall.com/sets/slp',
  },
  {
    code: 'sld-serialized', name: 'Serialized SLD promos', kind: 'promos', order: 2,
    description: 'Special serialized SLD cards, including the Secret Lair 295 convention giveaways. They are individual promos rather than normal drops.',
    sourceUrl: 'https://scryfall.com/search?q=set%3Asld+is%3Aserialized&unique=prints',
  },
  {
    code: 'sld-standalone', name: 'Standalone storefront and crossover promos', kind: 'promos', order: 3,
    description: 'One-card Secret Lair promotions sold or distributed on their own. Their source products are cataloged separately from ordinary multi-card drops.',
    sourceUrl: 'https://scryfall.com/search?q=set%3Asld+%28cn%3A908+or+cn%3A914+or+cn%3A918+or+cn%3A923%29&unique=prints',
  },
  {
    code: 'sld-current', name: 'Recent SLD catalog additions', kind: 'current catalog bridge', order: 4, galleryOnly: true,
    description: 'Recently published SLD printings that have reached Scryfall before the sealed-product catalog. They merge into the normal SLD Gallery and disappear from this bridge after the product seed catches up.',
    sourceUrl: `https://scryfall.com/search?q=${encodeURIComponent(SL_RECENT_SLD_QUERY)}&unique=prints`,
  },
  {
    code: 'slc', name: 'Secret Lair Countdown', kind: 'fixed-product printings', order: 5, galleryOnly: true,
    description: 'Every published SLC printing, including normal, foil, alternative, and separately numbered cards. Fixed kit completion remains governed by each product contract.',
    sourceUrl: 'https://scryfall.com/sets/slc',
  },
  {
    code: 'slu', name: 'Secret Lair: Ultimate Edition', kind: 'fixed-product printings', order: 6, galleryOnly: true,
    description: 'Every published SLU printing across both Ultimate Editions and the separately treated surprise bonus card.',
    sourceUrl: 'https://scryfall.com/sets/slu',
  },
  {
    code: 'pssc', name: 'Secret Lair Showcase: Planes', kind: 'memorabilia', order: 7,
    description: 'Oversized Showcase plane memorabilia. Shown for catalog completeness, but not treated as ordinary deck cards or a fixed drop.',
    sourceUrl: 'https://scryfall.com/sets/pssc',
  },
  {
    code: 'slx', name: 'Universes Within', kind: 'related', order: 8,
    description: 'Magic-universe versions of mechanically unique Secret Lair cards. These are related replacement printings, not products purchased from Secret Lair.',
    sourceUrl: 'https://scryfall.com/sets/slx',
  },
  {
    code: 'ptg', name: 'Ponies: The Galloping (2019 precursor)', kind: 'precursor', order: 9,
    description: 'A fixed three-card Hasbro Pulse charity set released before Secret Lair. It is shown as related history rather than relabeled as a Secret Lair drop.',
    sourceUrl: 'https://scryfall.com/sets/ptg',
  },
  {
    code: 'slz', name: 'The Zeta Set', kind: 'upcoming storefront set', order: 10, galleryOnly: true, preview: true,
    description: 'Every published SLZ preview. This is a set gallery, not a claim that all entries come in one purchase.',
    sourceUrl: 'https://scryfall.com/sets/slz',
  },
];

const SETTINGS_KEY = 'sl_supplemental_data';
let data = seed;

const cardRow = (c, setCode) => ({
  id: String(c.id || '').toLowerCase(),
  name: c.name || '',
  collectorNumber: c.collector_number || '',
  setCode,
  setName: c.set_name || '',
  releasedAt: c.released_at || '',
  finishes: c.finishes || [],
  promoTypes: c.promo_types || [],
  rarity: c.rarity || '',
  artist: c.artist || '',
});

const compactContent = contents => ({
  cards: (contents?.card || []).map(c => ({
    name: c.name || '', setCode: String(c.set || '').toUpperCase(), number: c.number || '',
    count: Number(c.count) || 1, finishes: c.finishes || (c.foil ? ['foil'] : []), foil: !!c.foil,
  })),
  sealed: (contents?.sealed || []).map(s => ({
    name: s.name || '', setCode: String(s.set || '').toUpperCase(), count: Number(s.count) || 1,
  })),
  variable: (contents?.variable || []).map(v => ({
    name: v.name || v.description || 'Variable contents', count: Number(v.count) || 1,
  })),
  other: (contents?.other || []).map(v => ({
    name: v.name || v.description || 'Other item', count: Number(v.count) || 1,
  })),
});

function standaloneSldPromos(mtgjson) {
  const cardsByUuid = new Map([...(mtgjson?.data?.cards || []), ...(mtgjson?.data?.tokens || [])]
    .map(card => [card.uuid, card]));
  return (mtgjson?.data?.sealedProduct || [])
    .filter(product => product.subtype === 'unknown' && /Secret Lair Promo/i.test(product.name || ''))
    .flatMap(product => (product.contents?.card || []).map(entry => cardsByUuid.get(entry.uuid)).filter(Boolean))
    .map(card => ({
      id: String(card.identifiers?.scryfallId || '').toLowerCase(), name: card.name || '',
      collectorNumber: card.number || '', setCode: 'sld-standalone', setName: 'Secret Lair Drop',
      releasedAt: card.originalReleaseDate || '', finishes: card.finishes || [], promoTypes: card.promoTypes || [],
      rarity: card.rarity || '', artist: card.artist || '',
    }))
    .filter(card => card.id);
}

export function buildSlSupplementalCatalog(setCards = {}, mtgjson = {}, generatedAt = new Date().toISOString()) {
  const sets = SL_SUPPLEMENTAL_SET_SPECS.map(spec => ({
    ...spec,
    cards: (spec.code === 'sld-standalone' ? standaloneSldPromos(mtgjson)
      : spec.code === 'sld-current' ? (setCards[spec.code] || []).filter(card => !productSeedIds.has(String(card.id || '').toLowerCase()))
        : (setCards[spec.code] || []))
      .map(c => c.collectorNumber ? c : cardRow(c, spec.code)),
  }));
  const bundles = (mtgjson?.data?.sealedProduct || [])
    .filter(p => p.subtype === 'secret_lair_bundle' || /Secret Lair Bundle/i.test(p.name || ''))
    .map(p => ({
      uuid: p.uuid || '', name: p.name || '', releaseDate: p.releaseDate || '',
      identifiers: { ...(p.identifiers || {}) }, contents: compactContent(p.contents || {}),
    }))
    .sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')) || a.name.localeCompare(b.name));
  return { generatedAt, sets, bundles };
}

async function fetchScryfallQuery(query) {
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=set&unique=prints`;
  const cards = [];
  while (url) {
    const resp = await netFetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} from Scryfall`);
    const json = await resp.json();
    cards.push(...(json.data || []));
    url = json.has_more ? json.next_page : null;
  }
  return cards;
}

function valid(candidate) {
  return candidate && Array.isArray(candidate.sets) && candidate.sets.length >= SL_SUPPLEMENTAL_SET_SPECS.length
    && Array.isArray(candidate.bundles) && candidate.bundles.length >= 100;
}

export async function loadSlSupplementalFromSettings() {
  try {
    const raw = await window.api?.settings?.get(SETTINGS_KEY);
    const cached = raw ? JSON.parse(raw) : null;
    if (valid(cached) && (!data?.generatedAt || String(cached.generatedAt) > String(data.generatedAt))) data = cached;
  } catch (e) { window.logger?.warn?.('SL', `supplemental catalog load failed: ${e.message}`); }
  return data;
}

export async function refreshSlSupplementalData(opts = {}) {
  try {
    const [slp, pssc, slx, ptg, slc, slu, slz, recentSld, serialized, mtgResult] = await Promise.all([
      fetchScryfallQuery('set:slp'), fetchScryfallQuery('set:pssc'), fetchScryfallQuery('set:slx'),
      fetchScryfallQuery('set:ptg'), fetchScryfallQuery('set:slc'), fetchScryfallQuery('set:slu'),
      fetchScryfallQuery('set:slz'), fetchScryfallQuery(SL_RECENT_SLD_QUERY), fetchScryfallQuery('set:sld is:serialized'),
      opts.mtgjson ? Promise.resolve(opts.mtgjson) : netFetch('https://mtgjson.com/api/v5/SLD.json'),
    ]);
    if (!opts.mtgjson && !mtgResult.ok) throw new Error(`HTTP ${mtgResult.status} from MTGJSON`);
    const mtgjson = opts.mtgjson || await mtgResult.json();
    const next = buildSlSupplementalCatalog({ slp, pssc, slx, ptg, slc, slu, slz, 'sld-current': recentSld, 'sld-serialized': serialized }, mtgjson);
    if (!valid(next)) throw new Error('supplemental source coverage was unexpectedly small');
    data = next;
    await window.api?.settings?.set(SETTINGS_KEY, JSON.stringify(data));
    window.logger?.success?.('SL', `Supplemental catalog: ${slSupplementalCardCount()} cards · ${data.bundles.length} bundles`);
    return true;
  } catch (e) {
    if (!opts.silent) window.logger?.warn?.('SL', `supplemental catalog refresh failed (using last good data): ${e.message}`);
    return false;
  }
}

export function slSupplementalSets() { return data?.sets || []; }
export function slSupplementalBundles() { return data?.bundles || []; }
export function slSupplementalCardCount() { return slSupplementalSets().reduce((n, set) => n + (set.cards || []).length, 0); }
export function slSupplementalInfo() {
  const sets = slSupplementalSets();
  return {
    generatedAt: data?.generatedAt || null,
    sets: sets.length,
    cards: slSupplementalCardCount(),
    relatedCards: sets.filter(set => !set.galleryOnly).reduce((n, set) => n + (set.cards || []).length, 0),
    bundles: slSupplementalBundles().length,
  };
}
