import { describe, expect, it } from 'vitest';
import { articleMatchesSearch } from '../src/renderer-js/briefing.js';

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
});
