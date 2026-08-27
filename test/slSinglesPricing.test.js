import { describe, expect, it } from 'vitest';
import { buildDropSinglesPricing, renderDropSinglesPricing } from '../src/renderer-js/slTab.js';

const card = (id, name, prices, extra = {}) => ({
  id,
  name,
  set: 'slc',
  set_name: 'Secret Lair Countdown',
  collector_number: id,
  prices,
  promo_types: [],
  ...extra,
});

describe('Secret Lair singles price comparisons', () => {
  it('keeps a fixed nonfoil SKU separate from its foil sibling', () => {
    const product = {
      legacyDrop: 'Example Drop',
      finish: 'nonfoil',
      finishLabel: '',
      cards: [
        { scryfallId: 'a', name: 'Alpha Card', finish: 'nonfoil', count: 1 },
        { scryfallId: 'b', name: 'Beta Card', finish: 'nonfoil', count: 2 },
      ],
    };
    const result = buildDropSinglesPricing(product, [
      card('a', 'Alpha Card', { usd: '10', usd_foil: '20' }),
      card('b', 'Beta Card', { usd: '5', usd_foil: '8' }),
    ], {
      'Alpha Card': { price: 1.5, set_name: 'Any Set', collector_number: '1', finish: 'usd' },
      'Beta Card': { price: 2, set_name: 'Another Set', collector_number: '2', finish: 'usd' },
    });

    expect(result.tiers.map(tier => tier.label)).toEqual([
      'Cheapest playable',
      'Exact printing · Nonfoil',
    ]);
    expect(result.tiers[0]).toMatchObject({ value: 5.5, priced: 3, total: 3, complete: true });
    expect(result.tiers[1]).toMatchObject({ value: 20, priced: 3, total: 3, complete: true });
    expect(result.tiers.some(tier => tier.label.endsWith('Foil'))).toBe(false);
  });

  it('prices only foil for a dedicated foil SKU', () => {
    const product = {
      legacyDrop: 'Example Drop Foil',
      finish: 'foil',
      finishLabel: 'Foil',
      cards: [
        { scryfallId: 'a', name: 'Alpha Card', finish: 'foil', count: 1 },
        { scryfallId: 'b', name: 'Beta Card', finish: 'foil', count: 1 },
      ],
    };
    const result = buildDropSinglesPricing(product, [
      card('a', 'Alpha Card', { usd: '10', usd_foil: '20' }),
      card('b', 'Beta Card', { usd: '5', usd_foil: '8' }),
    ], {
      'Alpha Card': { price: 1.5, finish: 'usd' },
      'Beta Card': { price: 2, finish: 'usd' },
    });

    expect(result.tiers).toHaveLength(2);
    expect(result.tiers[1]).toMatchObject({ label: 'Exact printing · Foil', value: 28, complete: true });
    expect(result.tiers.some(tier => tier.label.endsWith('Nonfoil'))).toBe(false);
  });

  it('shows lowest exact, nonfoil, foil, and Halo totals for a variable-finish kit', () => {
    const product = {
      legacyDrop: 'An Encyclopedia of Magic',
      finish: 'mixed',
      variableFinish: true,
      cards: [
        { scryfallId: 'a', alternateScryfallIds: ['ha'], name: 'Alpha Card', finish: 'any', count: 1 },
        { scryfallId: 'b', alternateScryfallIds: ['hb'], name: 'Beta Card', finish: 'any', count: 1 },
      ],
    };
    const result = buildDropSinglesPricing(product, [
      card('a', 'Alpha Card', { usd: '10', usd_foil: '12' }),
      card('ha', 'Alpha Card', { usd: null, usd_foil: '50' }, { promo_types: ['halofoil'] }),
      card('b', 'Beta Card', { usd: '20', usd_foil: '30' }),
      card('hb', 'Beta Card', { usd: null, usd_foil: '60' }, { promo_types: ['halofoil'] }),
    ], {
      'Alpha Card': { price: 1, set_name: 'Cheapest A', collector_number: '10', finish: 'usd' },
      'Beta Card': { price: 2, set_name: 'Cheapest B', collector_number: '20', finish: 'usd_foil' },
    });

    expect(result.tiers.map(tier => [tier.label, tier.value, tier.complete])).toEqual([
      ['Cheapest playable', 3, true],
      ['Exact printing · Lowest finish', 30, true],
      ['Exact printing · Nonfoil', 30, true],
      ['Exact printing · Foil', 42, true],
      ['Exact printing · Halo foil', 110, true],
    ]);
    expect(result.value).toBe(30);
    expect(result.complete).toBe(true);
  });

  it('labels a partially available finish as an incomplete subtotal', () => {
    const product = {
      finish: 'mixed',
      variableFinish: true,
      cards: [
        { scryfallId: 'a', alternateScryfallIds: ['ha'], name: 'Alpha Card', finish: 'any' },
        { scryfallId: 'b', name: 'Beta Card', finish: 'any' },
      ],
    };
    const result = buildDropSinglesPricing(product, [
      card('a', 'Alpha Card', { usd: '10', usd_foil: '12' }),
      card('ha', 'Alpha Card', { usd: null, usd_foil: '50' }, { promo_types: ['halofoil'] }),
      card('b', 'Beta Card', { usd: '20', usd_foil: '30' }),
    ], {});
    const halo = result.tiers.find(tier => tier.label === 'Exact printing · Halo foil');
    const html = renderDropSinglesPricing(result);

    expect(halo).toMatchObject({ value: 50, priced: 1, total: 2, complete: false });
    expect(html).toContain('Subtotal $50.00');
    expect(html).toContain('1/2 cards priced · incomplete');
    expect(html).toContain('Secret Lair Countdown · #ha · Halo foil');
    expect(html).toContain('No price found for this comparison');
  });

  it('uses each required finish for a fixed mixed-content product', () => {
    const result = buildDropSinglesPricing({
      finish: 'nonfoil',
      cards: [
        { scryfallId: 'a', name: 'Alpha Card', finish: 'foil' },
        { scryfallId: 'b', name: 'Beta Card', finish: 'nonfoil' },
      ],
    }, [
      card('a', 'Alpha Card', { usd: '10', usd_foil: '12' }),
      card('b', 'Beta Card', { usd: '20', usd_foil: '30' }),
    ], {});

    expect(result.tiers).toHaveLength(2);
    expect(result.tiers[1]).toMatchObject({ label: 'Exact printing · As released', value: 32, complete: true });
  });
});
