import { describe, expect, it } from 'vitest';
import { articleMatchesSearch, briefingArticleMatchesFilters, sortBriefingArticles } from '../src/renderer-js/briefing.js';

describe('Briefing article search', () => {
  const article = {
    title: 'A Marvelous Mathoms Superdrop',
    summary: 'Secret Lair cards inspired by The Hobbit.',
    author: 'Wizards of the Coast',
    category: 'announcements',
    kind: 'secret_lair',
    headings: ['Contents', 'Treasures from Middle-earth'],
  };

  it('searches titles, summaries, authors, categories, kinds, and headings', () => {
    for (const query of ['mathoms', 'hobbit', 'wizards', 'announcement', 'secret lair', 'middle-earth']) {
      expect(articleMatchesSearch(article, query)).toBe(true);
    }
  });

  it('is case-insensitive and excludes unrelated articles', () => {
    expect(articleMatchesSearch(article, 'MARVELOUS')).toBe(true);
    expect(articleMatchesSearch(article, 'banned and restricted')).toBe(false);
  });

  it('combines author, set, date, and parsed-card discovery filters', () => {
    const filtered = {
      ...article,
      author: 'Wizards of the Coast', setCode: 'SLD', publishedAt: '2026-08-10',
      embeddedCards: [{ imageUrl: 'https://media.wizards.com/card.webp' }],
    };
    expect(briefingArticleMatchesFilters(filtered, {
      author: 'Wizards of the Coast', setCode: 'SLD', dateFrom: '2026-08-01', dateTo: '2026-08-31', hasCards: 'yes',
    })).toBe(true);
    expect(briefingArticleMatchesFilters(filtered, { dateFrom: '2026-08-11' })).toBe(false);
    expect(briefingArticleMatchesFilters(filtered, { hasCards: 'no' })).toBe(false);
  });

  it('sorts by publish date, update date, and match completeness', () => {
    const rows = [
      { title: 'Older complete', publishedAt: '2026-01-01', contentUpdatedAt: '2026-08-10', embeddedCards: [{ scryfallId: 'a' }] },
      { title: 'Newer partial', publishedAt: '2026-08-01', contentUpdatedAt: '2026-08-02', embeddedCards: [{ scryfallId: 'b' }, { scryfallId: '' }] },
    ];
    expect(sortBriefingArticles(rows, 'newest')[0].title).toBe('Newer partial');
    expect(sortBriefingArticles(rows, 'updated')[0].title).toBe('Older complete');
    expect(sortBriefingArticles(rows, 'matches')[0].title).toBe('Older complete');
  });
});
