import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadBriefingState } from '../src/renderer-js/briefingState.js';
import { renderBriefing } from '../src/renderer-js/briefing.js';
import { ui } from '../src/renderer-js/state.js';
import { loadWizardsArticlesFromSettings } from '../src/renderer-js/wizardsArticles.js';

const URL = 'https://magic.wizards.com/en/news/feature/example-card-gallery';
const MATCHED = '00000000-0000-0000-0000-000000000001';

describe('Briefing workspace render', () => {
  beforeAll(async () => {
    const articleCache = {
      fetchedAt: '2026-08-13T12:00:00.000Z', parserVersion: 3,
      rows: [{
        url: URL, title: 'Example Card Gallery', category: 'feature', kind: 'product_guide',
        summary: 'An official gallery with matched and source-only artwork.', author: 'Wizards',
        publishedAt: '2026-08-13', discoveredAt: '2026-08-13T12:00:00.000Z', parserConfidence: 'high',
        headings: ['Cards'], sections: [{ heading: 'Cards', paragraphs: ['Gallery copy.'], summary: 'Gallery copy.' }],
        evidence: { title: 'article h1', publishedAt: 'structured metadata', cards: '2 Wizards card images' },
        releaseNoteCards: [{ name: 'Cloudshift' }], unmatchedCards: [],
        embeddedCards: [
          { name: 'Cloudshift', displayName: 'Cloudshift', imageUrl: 'https://media.wizards.com/cloudshift.webp', scryfallId: MATCHED, matchedName: 'Cloudshift' },
          { name: '', displayName: 'Artwork 2', imageUrl: 'https://media.wizards.com/artwork-2.webp' },
        ],
        cards: [{ id: MATCHED, name: 'Cloudshift', sourceName: 'Cloudshift', imageNormal: 'https://cards.scryfall.io/normal/cloudshift.jpg', match: { confidence: 'name', method: 'exact card name' } }],
      }],
    };
    globalThis.window = {
      api: { settings: {
        get: vi.fn(async key => key === 'wizards_article_data' ? JSON.stringify(articleCache) : JSON.stringify({ lastOpenedAt: '2026-08-12T12:00:00.000Z' })),
        set: vi.fn(async () => {}),
      } },
      logger: { warn: vi.fn() },
    };
    await loadWizardsArticlesFromSettings();
    await loadBriefingState();
    Object.assign(ui.briefing, { articleUrl: URL, filter: 'all', status: 'all', search: '', view: 'cards', cardFilter: 'all' });
  });

  it('renders reading controls, discovery filters, diagnostics, and collection-aware gallery actions', () => {
    const html = renderBriefing();
    expect(html).toContain('Jump to newest');
    expect(html).toContain('briefing-discovery');
    expect(html).toContain('Search this article');
    expect(html).toContain('Parsing details');
    expect(html).toContain('Save article');
    expect(html).toContain('showBriefingLightbox');
    expect(html).toContain('Name match');
    expect(html).toContain('Source');
    expect(html).toContain('Add 1 missing to want list');
  });
});
