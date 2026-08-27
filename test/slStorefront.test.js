import { describe, expect, it } from 'vitest';
import { matchStorefrontProductsToScryfallSets, parseSecretLairStorefrontHtml } from '../src/renderer-js/slStorefront.js';

describe('official Secret Lair storefront discovery', () => {
  const html = `
    <div class="slide"><img alt="Old storefront banner"></div>
    <section id="coming-soon">
      <div class="home-notify_me-container container" id="cv_thezetaset">
        <img alt="Secret Lair x MSCHF: The Zeta Set">
        <button ng-click="notifyMeCall(&quot;Secret Lair x MSCHF: The Zeta Set&quot;, 'cv_thezetaset')">GET NOTIFIED</button>
      </div>
      <div class="home-notify_me-container container" id="perfectly_normal_superdrop">
        <img alt="Superdrop logo">
        <button ng-click="notifyMeCall(&quot;&lt;strong&gt;A Perfectly Normal Superdrop&lt;\/strong&gt;&quot;, 'perfectly_normal_superdrop')">GET NOTIFIED</button>
      </div>
    </section>`;

  it('reads products only from the storefront Upcoming Events section', () => {
    expect(parseSecretLairStorefrontHtml(html)).toEqual([
      {
        title: 'Secret Lair x MSCHF: The Zeta Set', id: 'cv_thezetaset',
        url: 'https://secretlair.wizards.com/us/#cv_thezetaset',
      },
      {
        title: 'A Perfectly Normal Superdrop', id: 'perfectly_normal_superdrop',
        url: 'https://secretlair.wizards.com/us/#perfectly_normal_superdrop',
      },
    ]);
  });

  it('accepts a matching standalone code while rejecting ordinary set-title overlap', () => {
    const products = parseSecretLairStorefrontHtml(html);
    const matches = matchStorefrontProductsToScryfallSets(products, [
      { code: 'slz', name: 'The Zeta Set', released_at: '2099-09-02', set_type: 'box', card_count: 363, scryfall_uri: 'https://scryfall.com/sets/slz' },
      { code: 'pnm', name: 'A Perfectly Normal Superdrop', released_at: '2099-09-10', set_type: 'expansion', card_count: 300 },
      { code: 'sld', name: 'Secret Lair Drop', released_at: '2099-09-14', set_type: 'promo', card_count: 5000 },
      { code: 'slold', name: 'The Zeta Set', released_at: '2098-09-02', set_type: 'box', card_count: 363 },
    ], '2099-08-26');

    expect(matches).toEqual([expect.objectContaining({
      code: 'slz', name: 'The Zeta Set', releasedAt: '2099-09-02', setType: 'box', cardCount: 363,
      storeTitle: 'Secret Lair x MSCHF: The Zeta Set',
      storeUrl: 'https://secretlair.wizards.com/us/#cv_thezetaset',
    })]);
  });
});
