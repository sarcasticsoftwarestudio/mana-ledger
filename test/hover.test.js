import { describe, expect, it } from 'vitest';
import { buildSourceImageHoverHtml, buildUpcomingPreviewHoverHtml } from '../src/renderer-js/hover.js';

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
