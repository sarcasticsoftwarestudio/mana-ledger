import { describe, expect, it } from 'vitest';
import { projectLegacy } from '../src/renderer-js/slData.js';
import { mergeSlCountdownProducts, SL_COUNTDOWN_PRODUCTS, slCountdownGroupFor } from '../src/renderer-js/slCountdown.js';

describe('released Secret Lair Countdown products', () => {
  const kit30 = SL_COUNTDOWN_PRODUCTS.find(p => p.releaseDate === '2022-11-01');
  const encyclopedia = SL_COUNTDOWN_PRODUCTS.find(p => p.releaseDate === '2025-11-03');

  it('models only the 30 guaranteed anniversary cards', () => {
    expect(kit30.cards).toHaveLength(30);
    expect(kit30.cards.map(c => c.number)).toEqual(Array.from({ length: 30 }, (_, i) => String(1993 + i)));
    expect(kit30.cards.some(c => c.number === '2023')).toBe(false);
    expect(kit30.msrp).toBe(149.99);
  });

  it('models 26 Encyclopedia slots with one Halo alternative apiece', () => {
    expect(encyclopedia.cards).toHaveLength(26);
    expect(encyclopedia.cards.every(c => c.finish === 'any')).toBe(true);
    expect(encyclopedia.cards.every(c => c.alternateScryfallIds.length === 1)).toBe(true);
    expect(new Set(encyclopedia.cards.flatMap(c => [c.scryfallId, ...c.alternateScryfallIds])).size).toBe(52);
    expect(encyclopedia.cards.some(c => c.number === '27')).toBe(false);
    expect(encyclopedia.msrp).toBe(199.99);
  });

  it('projects one gallery card per guaranteed slot, not each alternative', () => {
    const model = mergeSlCountdownProducts({ products: [], scryfallToName: {} });
    const legacy = projectLegacy(model);
    expect(legacy.dropCards[kit30.legacyDrop]).toHaveLength(30);
    expect(legacy.dropCards[encyclopedia.legacyDrop]).toHaveLength(26);
    expect(legacy.scryfallToDrops[encyclopedia.cards[0].alternateScryfallIds[0]]).toBeUndefined();
  });

  it('merges idempotently and supplies release-aware standalone groups', () => {
    const once = mergeSlCountdownProducts({ products: SL_COUNTDOWN_PRODUCTS, scryfallToName: {} });
    const twice = mergeSlCountdownProducts(once);
    expect(twice.products.filter(p => p.uuid.startsWith('special:slc:'))).toHaveLength(2);
    expect(slCountdownGroupFor(kit30.legacyDrop)).toEqual({ superdrop: kit30.legacyDrop, date: '2022-11' });
    expect(slCountdownGroupFor(encyclopedia.legacyDrop)).toEqual({ superdrop: encyclopedia.legacyDrop, date: '2025-11' });
  });
});
