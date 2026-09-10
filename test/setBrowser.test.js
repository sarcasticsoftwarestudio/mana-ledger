import { afterEach, describe, expect, it } from 'vitest';
import { fetchSetCards, normalizeSetTarget } from '../src/renderer-js/search.js';

const originalApi = window.api;
afterEach(() => { window.api = originalApi; });

describe('set browser targets', () => {
  it('uses the PURL code for the Kirk convention promo without inspecting its collector number', () => {
    expect(normalizeSetTarget('PURL', 'URL/Convention Promos')).toEqual({
      code: 'purl',
      name: 'URL/Convention Promos',
      label: 'URL/Convention Promos · PURL',
      query: 'set:purl',
    });
  });

  it('keeps the Spock and Picard media promos in their actual PMEI set', () => {
    expect(normalizeSetTarget('pmei', 'Media and Collaboration Promos')).toMatchObject({
      code: 'pmei',
      query: 'set:pmei',
    });
  });

  it('rejects text that is not a set code instead of injecting it into a Scryfall query', () => {
    expect(normalizeSetTarget('purl or set:pmei', 'Promos')).toBeNull();
    expect(normalizeSetTarget('', 'Promos')).toBeNull();
  });

  it('loads every Scryfall page for a set and retains exact printing identities', async () => {
    const calls = [];
    const pages = [
      {
        data: [{ id: 'kirk-id', name: 'Kirk, Enterprising Captain', set: 'purl', set_name: 'URL/Convention Promos', collector_number: '2026-2' }],
        has_more: true,
        next_page: 'https://api.scryfall.com/cards/search?page=2&q=set%3Apurl',
      },
      {
        data: [{ id: 'older-promo-id', name: 'An Earlier Promo', set: 'purl', set_name: 'URL/Convention Promos', collector_number: '2025-1' }],
        has_more: false,
      },
    ];
    window.api = { net: { fetch: async url => {
      calls.push(url);
      return { ok: true, status: 200, text: JSON.stringify(pages[calls.length - 1]) };
    } } };

    const result = await fetchSetCards('PURL');

    expect(calls).toEqual([
      'https://api.scryfall.com/cards/search?q=set%3Apurl&unique=prints&order=set',
      'https://api.scryfall.com/cards/search?page=2&q=set%3Apurl',
    ]);
    expect(result.setName).toBe('URL/Convention Promos');
    expect(result.cards.map(card => card.id)).toEqual(['kirk-id', 'older-promo-id']);
  });
});
