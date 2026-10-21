import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_CARD_NAME, applyScryfallIdentity, cardNeedsIdentity } from '../src/renderer-js/prices.js';

const swordsPromo = {
  id: 'abc', name: 'Swords to Plowshares', set: 'slp', set_name: 'Secret Lair Promo',
  collector_number: '20', rarity: 'rare',
};

function placeholder(extra = {}) {
  return {
    scryfallId: 'abc', name: PLACEHOLDER_CARD_NAME, setCode: 'SLD', setName: 'Secret Lair Drop',
    collectorNumber: '', rarity: 'rare', ...extra,
  };
}

describe('card identity backfill', () => {
  it('flags placeholder and number-less entries, not identified ones', () => {
    expect(cardNeedsIdentity(placeholder())).toBe(true);
    expect(cardNeedsIdentity(placeholder({ name: 'Swords to Plowshares' }))).toBe(true);
    expect(cardNeedsIdentity(placeholder({ name: 'Swords to Plowshares', collectorNumber: '20' }))).toBe(false);
    expect(cardNeedsIdentity(placeholder({ scryfallId: '' }))).toBe(false);
  });

  it('fills an SL Explorer placeholder with the real printing', () => {
    const c = placeholder();
    expect(applyScryfallIdentity(c, swordsPromo)).toBe(true);
    expect(c).toMatchObject({
      name: 'Swords to Plowshares', setCode: 'slp', setName: 'Secret Lair Promo',
      collectorNumber: '20', rarity: 'rare',
    });
    expect(cardNeedsIdentity(c)).toBe(false);
  });

  it('keeps a real name and leaves identified entries untouched', () => {
    const named = placeholder({ name: 'Custom Name' });
    applyScryfallIdentity(named, swordsPromo);
    expect(named.name).toBe('Custom Name');
    expect(named.collectorNumber).toBe('20');

    const done = placeholder({ name: 'X', setCode: 'sld', collectorNumber: '7' });
    expect(applyScryfallIdentity(done, swordsPromo)).toBe(false);
    expect(done).toMatchObject({ name: 'X', setCode: 'sld', collectorNumber: '7' });
  });

  it('ignores a missing Scryfall result', () => {
    const c = placeholder();
    expect(applyScryfallIdentity(c, null)).toBe(false);
    expect(c.name).toBe(PLACEHOLDER_CARD_NAME);
  });
});
