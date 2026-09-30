import { describe, expect, it } from 'vitest';
import {
  buildSlUnownedHoverHtml, buildSourceImageHoverHtml, buildUpcomingPreviewHoverHtml, finishPriceBreakdown,
} from '../src/renderer-js/hover.js';

// Zndrsplt, Eye of Wisdom (SLD #379): nonfoil is the pricier finish.
const zndrsplt = { name: 'Zndrsplt, Eye of Wisdom', set: 'sld', collector_number: '379', prices: { usd: '35.73', usd_foil: '29.94', usd_etched: null } };

describe('finish price breakdown', () => {
  it('leads with the finish in context and lists the others', () => {
    const b = finishPriceBreakdown(zndrsplt, 'foil');
    expect(b.main).toMatchObject({ finish: 'foil', label: 'Foil', price: 29.94 });
    expect(b.others).toEqual([{ finish: 'nonfoil', label: 'Nonfoil', price: 35.73 }]);
  });

  it('leads with nonfoil when the context finish is unknown or normal', () => {
    expect(finishPriceBreakdown(zndrsplt, '').main.price).toBe(35.73);
    expect(finishPriceBreakdown(zndrsplt, 'normal').main.price).toBe(35.73);
  });

  it('falls back to a priced finish and labels it truthfully', () => {
    const b = finishPriceBreakdown({ prices: { usd_foil: '4.00' } }, 'etched');
    expect(b.main).toMatchObject({ finish: 'foil', label: 'Foil', price: 4 });
    expect(b.others).toEqual([]);
  });

  it('labels premium foils by their treatment and counts them as foil', () => {
    const b = finishPriceBreakdown({ promo_types: ['galaxyfoil'], prices: { usd: '1.00', usd_foil: '9.00' } }, 'foil');
    expect(b.main).toMatchObject({ finish: 'foil', label: 'Galaxy foil', price: 9 });
  });

  it('returns null when nothing is priced', () => {
    expect(finishPriceBreakdown({ prices: {} }, 'foil')).toBeNull();
  });
});

describe('unowned printing hover', () => {
  it('shows the precon slot finish first and the other finishes under it', () => {
    const html = buildSlUnownedHoverHtml('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', zndrsplt, 'foil');
    const main = html.indexOf('$29.94'), other = html.indexOf('$35.73');
    expect(main).toBeGreaterThan(-1);
    expect(other).toBeGreaterThan(main);
    expect(html).toContain('chp-finishes');
  });
});

describe('unmatched source-image hover', () => {
  it('builds an enlarged preview without claiming a card match', () => {
    const html = buildSourceImageHoverHtml({
      imageUrl: 'https://media.wizards.com/card.webp?size=large&face=front',
      label: 'Artwork 7',
      section: 'Scene cards',
    });

    expect(html).toContain('chp-source-img');
    expect(html).toContain('Artwork 7');
    expect(html).toContain('Scene cards');
    expect(html).toContain('No exact card match');
    expect(html).toContain('&amp;face=front');
  });

  it('escapes source labels before rendering them', () => {
    const html = buildSourceImageHoverHtml({
      imageUrl: 'https://media.wizards.com/card.webp',
      label: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('upcoming official-art hover', () => {
  it('combines official art with matched Scryfall rules details', () => {
    const html = buildUpcomingPreviewHoverHtml({
      imageUrl: 'https://media.wizards.com/2099/cloudshift.webp',
      label: 'Cloudshift as "Known Hero"',
      scryfallId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    }, {
      name: 'Cloudshift', type_line: 'Instant', oracle_text: 'Exile target creature, then return it.',
      rarity: 'common', cmc: 1, artist: 'Reference Artist', prices: { usd: '99.00' },
    }, {
      price: 0.25, set_name: 'Avacyn Restored', finish: 'usd_foil',
    });

    expect(html).toContain('https://media.wizards.com/2099/cloudshift.webp');
    expect(html).toContain('Matched to Cloudshift');
    expect(html).toContain('Exile target creature');
    expect(html).toContain('$0.25');
    expect(html).toContain('Cheapest available printing · Avacyn Restored · Foil');
    expect(html).not.toContain('$99.00');
    expect(html).not.toContain('cards.scryfall.io');
  });

  it('keeps unmatched official previews hoverable without guessing an identity', () => {
    const html = buildUpcomingPreviewHoverHtml({
      imageUrl: 'https://media.wizards.com/2099/new-hero.webp', label: 'Brand New Hero',
    });

    expect(html).toContain('Brand New Hero');
    expect(html).toContain('No existing card match');
    expect(html).toContain('chp-source-img');
  });
});
