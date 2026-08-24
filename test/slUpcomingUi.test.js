import { describe, expect, it } from 'vitest';
import { renderUpcomingPriceBreakdown, slCardTile, upcomingOfficialPreviewTile, upcomingSaleDateLabel } from '../src/renderer-js/slTab.js';
import { sumUpcomingCheapest } from '../src/renderer-js/slUpcoming.js';

describe('upcoming Secret Lair pricing UI', () => {
  it('labels an unavailable official sale date without hiding the drop', () => {
    expect(upcomingSaleDateLabel(null)).toBe('Sale date unavailable · check official announcement');
    expect(upcomingSaleDateLabel('2099-07-27')).toBe('July 27, 2099');
  });

  it('does not add redundant native tooltips to preview or reference cards', () => {
    const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const preview = slCardTile(id, '2816', undefined, { preview: true });
    const reference = slCardTile(id, undefined, undefined, { reference: true });

    expect(preview).toContain('Exact preview');
    expect(reference).toContain('Reference');
    expect(preview).not.toContain(' title=');
    expect(reference).not.toContain(' title=');
  });

  it('renders official art while retaining an optional Scryfall identity match', () => {
    const matched = upcomingOfficialPreviewTile({
      displayName: 'Cloudshift as "Known Hero"', imageUrl: 'https://media.wizards.com/2099/cloudshift.webp',
      scryfallId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', matchType: 'reference',
      matchedName: 'Cloudshift',
    }, {
      unitPrice: 0.25, setName: 'Avacyn Restored', finish: 'usd_foil',
    });
    const unique = upcomingOfficialPreviewTile({
      displayName: 'Brand New Hero', imageUrl: 'https://media.wizards.com/2099/new-hero.webp', matchType: 'source',
    });

    expect(matched).toContain('src="https://media.wizards.com/2099/cloudshift.webp"');
    expect(matched).toContain('data-upcoming-scryfall-id="eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"');
    expect(matched).toContain('data-upcoming-cheapest-price="0.25"');
    expect(matched).toContain('data-upcoming-cheapest-set="Avacyn Restored"');
    expect(matched).toContain('data-upcoming-cheapest-finish="usd_foil"');
    expect(matched).toContain('Name match');
    expect(unique).toContain('src="https://media.wizards.com/2099/new-hero.webp"');
    expect(unique).toContain('New / unmatched');
    expect(unique).toContain('data-act="open-url"');
  });

  it('renders the cheapest printing, unit price, quantity, and subtotal for every announced card', () => {
    const estimate = sumUpcomingCheapest([
      { name: 'Wedding Ring', displayName: `Wedding Ring as "Mermaid's Pendant"`, quantity: 1 },
      { name: 'Food', displayName: 'Food Tokens', quantity: 7 },
      { name: 'Unpriced Preview', quantity: 1 },
    ], {
      'Wedding Ring': { price: 4.5, set_name: 'Crimson Vow Commander', finish: 'usd' },
      Food: { price: 0.25, set_name: 'Tokens' },
    });
    const html = renderUpcomingPriceBreakdown(estimate);

    expect(html).toContain('Wedding Ring as &quot;Mermaid\'s Pendant&quot;');
    expect(html).toContain('Crimson Vow Commander');
    expect(html).toContain('Nonfoil');
    expect(html).toContain('$4.50');
    expect(html).toContain('7 × $0.25');
    expect(html).toContain('$1.75 subtotal');
    expect(html).toContain('Unpriced Preview');
    expect(html).toContain('Unavailable');
  });
});
