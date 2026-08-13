import { describe, expect, it } from 'vitest';
import { buildSourceImageHoverHtml } from '../src/renderer-js/hover.js';

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
