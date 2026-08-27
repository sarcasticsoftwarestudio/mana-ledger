#!/usr/bin/env node
// Read-only coverage audit across the app baseline, the official-style product
// catalogs used by Mana Ledger, Scryfall's Secret Lair set family, MTGJSON
// bundles, and the mtg.wiki master drop list. Intended for release review.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const headers = { 'User-Agent': 'ManaLedgerCoverageAudit/1.0', Accept: 'application/json' };
const norm = value => String(value || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[–—]/g, '-')
  .replace(/\band\b/g, '').replace(/[^a-z0-9]+/g, '');

async function json(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} from ${url}`);
  return response.json();
}

(async () => {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'secretlair.js'), 'utf8')
    + '\n;globalThis.__audit={drops:SL_DROP_CARDS,maps:SL_SCRYFALL_TO_DROPS};';
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context);
  const { SL_SPECIAL_PRODUCTS } = await import('../src/renderer-js/slSpecialProducts.js');
  const { default: productSeed } = await import('../src/renderer-js/data/slProductSeed.js');
  const { parseDropSeriesWikitext } = await import('../src/renderer-js/slWiki.js');
  const { default: supplemental } = await import('../src/renderer-js/data/slSupplementalSeed.js');
  const [setsJson, wikiJson, mtgjson] = await Promise.all([
    json('https://api.scryfall.com/sets'),
    json('https://mtg.wiki/api.php?action=parse&page=Secret%20Lair%2FDrop%20Series&prop=wikitext&format=json'),
    json('https://mtgjson.com/api/v5/SLD.json'),
  ]);

  const relatedCodes = new Set(['slx', 'slz', 'pssc', 'ptg']);
  const family = (setsJson.data || []).filter(set => /^sl/.test(set.code) || /secret lair/i.test(set.name) || relatedCodes.has(set.code))
    .sort((a, b) => String(a.released_at).localeCompare(String(b.released_at)));
  const wikiRows = parseDropSeriesWikitext(wikiJson?.parse?.wikitext?.['*'] || '');
  const today = new Date().toISOString().slice(0, 10);
  const known = new Set([...Object.keys(context.__audit.drops), ...(productSeed.products || []).flatMap(p => [p.legacyDrop, p.dropName]),
    ...SL_SPECIAL_PRODUCTS.map(p => p.legacyDrop)].map(norm));
  const covered = row => {
    const key = norm(row.drop);
    if (known.has(key)) return true;
    const familyAliases = {
      theastrologylands: 'astrologylands',
      sakurasuperstar: 'sakurasuperstar',
      thestrangesands: 'thestrangesands',
    };
    const fragment = familyAliases[key];
    return !!fragment && [...known].some(candidate => candidate.includes(fragment));
  };
  const missingReleasedDrops = wikiRows.filter(row => row.date && row.date <= today && !covered(row));
  const firstSale = ['<explosion sounds>', 'Bitterblossom Dreams', 'Eldraine Wonderland', 'Kaleidoscope Killers', 'OMG KITTIES!', 'Restless in Peace', 'Seeing Visions'];
  const firstSaleMissing = firstSale.filter(name => !known.has(norm(name)));
  const sealed = mtgjson?.data?.sealedProduct || [];
  const productIds = new Set((productSeed.products || []).map(product => product.uuid));
  const bundleIds = new Set((supplemental.bundles || []).map(bundle => bundle.uuid));
  const sourceBundles = sealed.filter(product => product.subtype === 'secret_lair_bundle' || /Secret Lair Bundle/i.test(product.name || ''));
  const sourceCore = sealed.filter(product => ['secret_lair', 'commander'].includes(product.subtype) && !/Secret Lair Bundle/i.test(product.name || ''));
  const sourceStandalone = sealed.filter(product => product.subtype === 'unknown' && /Secret Lair Promo/i.test(product.name || ''));
  const uncatalogedBundles = sourceBundles.filter(product => !bundleIds.has(product.uuid));
  const uncatalogedCore = sourceCore.filter(product => !productIds.has(product.uuid));
  const standaloneCount = (supplemental.sets.find(set => set.code === 'sld-standalone')?.cards || []).length;
  const unexpectedProducts = sealed.filter(product => !sourceBundles.includes(product) && !sourceCore.includes(product) && !sourceStandalone.includes(product));
  const dispositions = {
    sld: 'regular Explorer + separately documented bonus cards',
    slu: 'fixed products in Explorer', slc: 'fixed Countdown products in Explorer',
    slp: 'Promos & Related gallery', slx: 'related reprints gallery',
    pssc: 'memorabilia gallery', ptg: 'clearly labeled precursor gallery',
    slz: 'storefront-verified Upcoming set gallery (variable contents)',
    slci: 'reviewed and excluded: unrelated Lost Caverns substitute-card token',
  };
  const unknownRelatedSets = family.filter(set => !dispositions[set.code]);

  console.log('\nSecret Lair coverage audit');
  console.log(`- Explorer regular drops: ${Object.keys(context.__audit.drops).length}`);
  console.log(`- Exact SLD product fallback: ${(productSeed.products || []).length} products`);
  console.log(`- Fixed special products: ${SL_SPECIAL_PRODUCTS.length} (${SL_SPECIAL_PRODUCTS.map(p => p.legacyDrop).join('; ')})`);
  console.log(`- Supplemental galleries: ${supplemental.sets.length} · ${supplemental.sets.reduce((n, set) => n + set.cards.length, 0)} cards`);
  console.log(`- Bundle/Festival catalog: ${supplemental.bundles.length}`);
  console.log(`- MTGJSON product records: ${sourceCore.length} exact drops/decks · ${sourceBundles.length} bundles · ${sourceStandalone.length} standalone promos · ${unexpectedProducts.length} unclassified`);
  console.log(`- MTGJSON records absent from their catalog: ${uncatalogedCore.length + uncatalogedBundles.length + Math.max(0, sourceStandalone.length - standaloneCount)}`);
  console.log(`- Released wiki rows absent from Explorer: ${missingReleasedDrops.length}`);
  for (const row of missingReleasedDrops) console.log(`  ! ${row.date} · ${row.drop}`);
  console.log(`- Original December 2019 sale: ${firstSaleMissing.length ? `MISSING ${firstSaleMissing.join(', ')}` : 'all 7 drops present'}`);
  console.log('\nReviewed Scryfall family');
  for (const set of family) {
    console.log(`- ${set.code.toUpperCase()} · ${set.name} · ${set.card_count} · ${dispositions[set.code] || 'UNREVIEWED SET CODE'}`);
  }

  if (missingReleasedDrops.length || firstSaleMissing.length || uncatalogedCore.length || uncatalogedBundles.length
    || standaloneCount < sourceStandalone.length || unexpectedProducts.length || unknownRelatedSets.length
    || supplemental.bundles.length < 100) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exit(1);
});
