import { describe, expect, it } from 'vitest';
import productSeed from '../src/renderer-js/data/slProductSeed.js';
import supplementalSeed from '../src/renderer-js/data/slSupplementalSeed.js';
import { projectLegacy } from '../src/renderer-js/slData.js';
import { SL_SPECIAL_PRODUCTS, SL_ULTIMATE_PRODUCTS, mergeSlSpecialProducts } from '../src/renderer-js/slSpecialProducts.js';

describe('Secret Lair non-standard catalog coverage', () => {
  it('ships both fixed SLU products without counting the bonus Blast Zone', () => {
    expect(SL_ULTIMATE_PRODUCTS.map(product => product.cards.length)).toEqual([5, 10]);
    expect(SL_ULTIMATE_PRODUCTS.flatMap(product => product.cards).some(card => card.number === '504')).toBe(false);
    expect(SL_ULTIMATE_PRODUCTS[0]).toMatchObject({ releaseDate: '2020-06-12', finish: 'nonfoil' });
    expect(SL_ULTIMATE_PRODUCTS[1]).toMatchObject({ releaseDate: '2021-05-07', finish: 'foil' });
  });

  it('projects all four fixed non-SLD products into normal Explorer drops', () => {
    const model = mergeSlSpecialProducts({ products: [], scryfallToName: {} });
    const legacy = projectLegacy(model);
    expect(model.products).toHaveLength(4);
    expect(Object.keys(legacy.dropCards)).toEqual(expect.arrayContaining(SL_SPECIAL_PRODUCTS.map(product => product.legacyDrop)));
  });

  it('ships every reviewed promo and related set as a separated gallery', () => {
    const counts = Object.fromEntries(supplementalSeed.sets.map(set => [set.code, set.cards.length]));
    expect(counts).toEqual({ slp: 54, 'sld-serialized': 6, 'sld-standalone': 4, 'sld-current': 1, slc: 84, slu: 16, pssc: 10, slx: 30, ptg: 3, slz: 270 });
    expect(supplementalSeed.sets.filter(set => !set.galleryOnly).reduce((n, set) => n + set.cards.length, 0)).toBe(107);
    expect(new Set(supplementalSeed.sets.flatMap(set => set.cards.map(card => card.id))).size).toBe(478);
    expect(supplementalSeed.sets.find(set => set.code === 'slz')).toMatchObject({ galleryOnly: true, preview: true });
    expect(supplementalSeed.sets.find(set => set.code === 'sld-current').cards[0]).toMatchObject({
      name: "Trostani, Selesnya's Voice", collectorNumber: '2443',
    });
  });

  it('ships the composite bundle catalog without turning bundles into drops', () => {
    expect(supplementalSeed.bundles.length).toBeGreaterThanOrEqual(212);
    expect(supplementalSeed.bundles.some(bundle => /Festival in a Box/i.test(bundle.name))).toBe(true);
    expect(SL_SPECIAL_PRODUCTS.some(product => /Festival in a Box/i.test(product.name))).toBe(false);
  });

  it('uses the exact MTGJSON product fallback for subset-tag gaps', () => {
    const names = new Set(productSeed.products.map(product => product.legacyDrop));
    expect(names.has('Oishii Tokens')).toBe(true);
    expect([...names].some(name => name.includes('Sakura Superstar'))).toBe(true);
    expect([...names].some(name => name.includes('The Strange Sands'))).toBe(true);
    expect([...names].some(name => name.includes('Astrology Lands'))).toBe(true);
    expect(productSeed.products.some(product => /Digital Sensation Japanese Rainbow Foil/i.test(product.name))).toBe(true);
    expect(productSeed.products.some(product => /Electric Entourage English Rainbow Foil/i.test(product.name))).toBe(true);
    expect(productSeed.products.some(product => /Special Guest Junji Ito Japanese$/i.test(product.name))).toBe(true);
  });
});
