import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyBriefingCorrections, articleIsNew, articleIsRead, articleIsSaved, articleIsUpdated,
  beginBriefingSession, briefingCardKey, clearBriefingCorrection, loadBriefingState,
  markBriefingArticleRead, setBriefingCorrection, toggleBriefingSaved,
} from '../src/renderer-js/briefingState.js';

const URL = 'https://magic.wizards.com/en/news/feature/example';

describe('persistent Briefing state', () => {
  let saved;
  beforeEach(async () => {
    saved = [];
    globalThis.window = {
      api: { settings: { get: vi.fn(async () => JSON.stringify({ lastOpenedAt: '2026-08-10T12:00:00.000Z' })), set: vi.fn(async (_key, value) => saved.push(JSON.parse(value))) } },
      logger: { warn: vi.fn() },
    };
    await loadBriefingState();
    beginBriefingSession();
  });

  it('tracks new, unread, updated, and saved state across mutations', async () => {
    const article = { url: URL, discoveredAt: '2026-08-11T12:00:00.000Z', contentUpdatedAt: '2026-08-12T12:00:00.000Z' };
    expect(articleIsNew(article)).toBe(true);
    expect(articleIsRead(article)).toBe(false);
    expect(articleIsUpdated(article)).toBe(true);
    await markBriefingArticleRead(article);
    expect(articleIsRead(article)).toBe(true);
    expect(articleIsUpdated(article)).toBe(true); // retained for the current reading session
    expect(await toggleBriefingSaved(URL)).toBe(true);
    expect(articleIsSaved(article)).toBe(true);
    expect(saved.length).toBeGreaterThan(0);
  });

  it('applies and clears local corrections for images and parsed names', async () => {
    const image = { name: 'Artwork 1', imageUrl: 'https://media.wizards.com/art.webp' };
    const named = { name: 'Cloudshift' };
    await setBriefingCorrection(URL, briefingCardKey(image), { scryfallId: 'ABC', name: 'Correct Card' });
    await setBriefingCorrection(URL, briefingCardKey(named), { scryfallId: 'DEF', name: 'Cloudshift' });
    const corrected = applyBriefingCorrections({ url: URL, embeddedCards: [image], releaseNoteCards: [named] });
    expect(corrected.embeddedCards[0]).toMatchObject({ scryfallId: 'abc', matchedName: 'Correct Card', manualCorrection: true });
    expect(corrected.releaseNoteCards[0]).toMatchObject({ scryfallId: 'def', matchedName: 'Cloudshift', manualCorrection: true });
    await clearBriefingCorrection(URL, briefingCardKey(image));
    expect(applyBriefingCorrections({ url: URL, embeddedCards: [image] }).embeddedCards[0].scryfallId).toBeUndefined();
  });
});
