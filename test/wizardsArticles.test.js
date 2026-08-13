import { describe, expect, it } from 'vitest';
import {
  classifyWizardsArticle,
  importWizardsArticle,
  parseReleaseNoteCards,
  parseWizardsArticleHtml,
  parseWizardsFeedHtml,
  resolveWizardsArticleCards,
  sanitizeWizardsArticle,
} from '../src/renderer-js/wizardsArticles.js';

describe('Wizards Briefing parser', () => {
  it('discovers articles across semantic cards and unwrapped feature rails', () => {
    const rows = parseWizardsFeedHtml(`
      <article><a href="/en/news/announcements/rules-change">Rules Change</a><time datetime="2026-08-10"></time><p>Official update.</p></article>
      <div><a href="/en/news/feature/set-release-notes">Set Release Notes</a></div>
      <a href="/en/news/announcements/rules-change">Read More</a>
      <a href="/en/news/archive">Archive</a>
    `);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.title)).toEqual(['Rules Change', 'Set Release Notes']);
    expect(rows[0]).toMatchObject({ category: 'announcements', publishedAt: '2026-08-10' });
  });

  it('classifies from the article identity before unrelated page recommendations', () => {
    expect(classifyWizardsArticle({
      title: 'Banned and Restricted Announcement – August 10, 2026',
      category: 'announcements',
      headings: ['Related: Secret Lair Superdrop'],
    })).toBe('banned_restricted');
    expect(classifyWizardsArticle({
      title: 'Secret Lair: A New Superdrop',
      category: 'announcements',
      headings: ['Format Check-In'],
    })).toBe('secret_lair');
    expect(classifyWizardsArticle({ title: 'Example Set Release Notes', category: 'feature' })).toBe('release_notes');
  });

  it('parses release-note metadata, sections, collector ranges and card rulings', () => {
    const html = `
      <meta name="description" content="Rules and release information for Example Set.">
      <meta property="og:image" content="https://example.test/hero.jpg">
      <script type="application/ld+json">{"datePublished":"2026-08-03T08:00:00Z","dateModified":"2026-08-04T08:00:00Z","author":{"name":"Rules Team"}}</script>
      <main>
        <h1>Example Set Release Notes</h1>
        <p>ABC collector numbers 1–2 are tournament legal.</p>
        <p>ABC collector numbers 3–3 have an acorn stamp.</p>
        <a href="https://media.wizards.com/example.pdf">English PDF</a>
        <h2>General Notes</h2><p>These notes explain the set.</p>
        <h2>Example Set Card-Specific Notes</h2>
        <p>Alpha Hero {1}{W} Legendary Creature — Human 2/2 Flying</p>
        <ul><li>Alpha Hero can target itself.</li></ul>
        <p>Beta Lesson {2}{U} Sorcery Draw two cards.</p>
        <ul><li>Resolve the instructions in order.</li></ul>
        <h2>Example Set Alchemy Card-Specific Notes</h2>
        <p>Gamma Relic {3} Artifact {T}: Add one mana.</p>
        <ul><li>This is not legal in Constructed formats.</li></ul>
        <h2>Magic: The Gathering Footer</h2>
      </main>
    `;
    const article = parseWizardsArticleHtml(html, {
      url: 'https://magic.wizards.com/en/news/feature/example-release-notes',
      category: 'feature',
    });
    expect(article).toMatchObject({
      title: 'Example Set Release Notes',
      kind: 'release_notes',
      author: 'Rules Team',
      setCode: 'ABC',
      parserConfidence: 'high',
    });
    expect(article.collectorNumbers).toEqual(['1', '2', '3']);
    expect(article.pdfLinks[0].label).toBe('English PDF');
    expect(article.releaseNoteCards.map(card => card.name)).toEqual(['Alpha Hero', 'Beta Lesson', 'Gamma Relic']);
    expect(article.releaseNoteCards[0].rulings).toEqual(['Alpha Hero can target itself.']);
  });

  it('extracts card blocks without depending on surrounding wrapper classes', () => {
    const cards = parseReleaseNoteCards(`
      <section><h2>Card-Specific Notes</h2>
        <div><p>One Card {G} Creature — Elf 1/1</p><ul><li>One ruling.</li></ul></div>
        <div><p>Second Card {1}{B} Instant Destroy target creature.</p><ul><li>Second ruling.</li></ul></div>
      </section>
    `);
    expect(cards).toEqual([
      expect.objectContaining({ name: 'One Card', rulings: ['One ruling.'] }),
      expect.objectContaining({ name: 'Second Card', rulings: ['Second ruling.'] }),
    ]);
  });

  it('resolves an exact set collector range and carries parsed rulings onto cards', async () => {
    const article = sanitizeWizardsArticle({
      url: 'https://magic.wizards.com/en/news/feature/example-release-notes',
      title: 'Example Set Release Notes',
      kind: 'release_notes',
      category: 'feature',
      setCode: 'ABC',
      collectorNumbers: ['1', '2', '3'],
      releaseNoteCards: [
        { name: 'Alpha Hero', rulings: ['Alpha ruling.'] },
        { name: 'Beta Lesson', rulings: ['Beta ruling.'] },
        { name: 'Gamma Relic', rulings: [] },
      ],
    });
    const resolved = await resolveWizardsArticleCards(article, async identifiers => ({
      data: identifiers.map((identifier, index) => ({
        id: `00000000-0000-0000-0000-00000000000${index + 1}`,
        name: ['Alpha Hero', 'Beta Lesson', 'Gamma Relic'][index],
        set: 'abc', set_name: 'Example Set', collector_number: String(index + 1), rarity: 'rare',
        type_line: 'Creature', oracle_text: `Oracle ${index + 1}`, artist: 'Example Artist',
        image_uris: { small: `https://cards.scryfall.io/small/${index + 1}.jpg`, normal: `https://cards.scryfall.io/normal/${index + 1}.jpg` },
      })),
      not_found: [],
    }));
    expect(resolved.cardMatchStatus).toBe('complete');
    expect(resolved.cards).toHaveLength(3);
    expect(resolved.cards[0]).toMatchObject({
      name: 'Alpha Hero', setCode: 'ABC', collectorNumber: '1', rulings: ['Alpha ruling.'],
      match: { method: 'set + collector number', confidence: 'exact' },
    });
    expect(resolved.unmatchedCards).toEqual([]);
  });

  it('keeps a useful generic fallback when no specialized structure matches', () => {
    const article = parseWizardsArticleHtml(`
      <meta property="og:description" content="A general behind-the-scenes story.">
      <h1>How We Built the Set</h1>
      <div><h2>First idea</h2><p>This paragraph is intentionally long enough to become readable article context for the Briefing view.</p></div>
    `, { url: 'https://magic.wizards.com/en/news/feature/how-we-built-the-set', category: 'feature' });
    expect(article.kind).toBe('feature');
    expect(article.summary).toBe('A general behind-the-scenes story.');
    expect(article.sections[0]).toMatchObject({ heading: 'First idea' });
    expect(article.cards).toEqual([]);
  });

  it('rejects non-Wizards and non-article URLs before fetching', async () => {
    await expect(importWizardsArticle('https://example.com/en/news/feature/not-wizards')).rejects.toThrow(/magic\.wizards\.com/i);
    await expect(importWizardsArticle('https://magic.wizards.com/en/news')).rejects.toThrow(/article URL/i);
  });
});
