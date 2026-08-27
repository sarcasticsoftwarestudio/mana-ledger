import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DASHBOARD_PANEL_NAMES,
  HELP_GROUPS,
  HELP_GUIDES,
  helpGuideById,
  searchHelpGuides,
} from '../src/renderer-js/helpCenter.js';

describe('end-user Help Center', () => {
  it('has a unique, categorized guide for every major workspace and workflow', () => {
    expect(HELP_GUIDES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(HELP_GUIDES.map(guide => guide.id)).size).toBe(HELP_GUIDES.length);
    expect(HELP_GUIDES.every(guide => HELP_GROUPS.includes(guide.group))).toBe(true);
    expect(HELP_GUIDES.every(guide => guide.title && guide.summary && guide.body.length > 250)).toBe(true);

    const required = [
      'dashboard', 'charts', 'cards', 'sealed', 'search', 'decks', 'precons',
      'secret-lair', 'upcoming', 'briefing', 'want-list', 'insights',
      'local-intelligence', 'pricing', 'failures', 'settings', 'backups',
    ];
    expect(required.every(id => HELP_GUIDES.some(guide => guide.id === id))).toBe(true);
  });

  it('documents every built-in dashboard panel', () => {
    expect(DASHBOARD_PANEL_NAMES).toHaveLength(23);
    const dashboardText = helpGuideById('dashboard').body.toLowerCase();
    for (const panel of DASHBOARD_PANEL_NAMES) expect(dashboardText).toContain(panel.toLowerCase());
  });

  it('searches titles, summaries, keywords, and guide text using all query words', () => {
    expect(searchHelpGuides('dashboard chart').map(guide => guide.id)).toContain('charts');
    expect(searchHelpGuides('storefront set code').map(guide => guide.id)).toContain('upcoming');
    expect(searchHelpGuides('partial card sale').map(guide => guide.id)).toContain('selling');
    expect(searchHelpGuides('offline privacy').map(guide => guide.id)).toContain('local-intelligence');
    expect(searchHelpGuides('words that cannot possibly match')).toEqual([]);
  });

  it('falls back to the welcome guide for an unknown deep link', () => {
    expect(helpGuideById('not-a-real-guide').id).toBe('welcome');
  });

  it('is reachable from the native Help menu and renderer action', () => {
    const mainProcess = readFileSync(new URL('../src/main/main.js', import.meta.url), 'utf8');
    const renderer = readFileSync(new URL('../src/renderer-js/main.js', import.meta.url), 'utf8');
    expect(mainProcess).toContain("label: 'Mana Ledger Guide'");
    expect(mainProcess).toContain("sendMenu('help:show')");
    expect(renderer).toContain("case 'help:show':");
    expect(renderer).toContain('showHelpCenter()');
  });
});
