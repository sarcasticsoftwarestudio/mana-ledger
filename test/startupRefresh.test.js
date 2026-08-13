import { describe, expect, it } from 'vitest';
import { startupRefreshPlan } from '../src/renderer-js/startupRefresh.js';

const NOW = new Date(2026, 7, 13, 9, 30, 0);

describe('startupRefreshPlan', () => {
  it('joins Briefing to the first-open-today collection refresh', () => {
    expect(startupRefreshPlan({
      hasCards: true,
      lastPriceRefresh: new Date(2026, 7, 12, 23, 55, 0).toISOString(),
      briefingNeedsRefresh: false,
      now: NOW,
    })).toEqual({ briefing: true, prices: true, secretLair: true, precons: true });
  });

  it('does not repeat automatic work after the daily refresh', () => {
    expect(startupRefreshPlan({
      hasCards: true,
      lastPriceRefresh: new Date(2026, 7, 13, 0, 5, 0).toISOString(),
      briefingNeedsRefresh: false,
      now: NOW,
    })).toEqual({ briefing: false, prices: false, secretLair: false, precons: false });
  });

  it('refreshes stale Briefing data even without collection cards', () => {
    expect(startupRefreshPlan({
      hasCards: false,
      briefingNeedsRefresh: true,
      now: NOW,
    })).toEqual({ briefing: true, prices: false, secretLair: false, precons: false });
  });

  it('treats invalid refresh timestamps as due', () => {
    expect(startupRefreshPlan({
      hasCards: true,
      lastPriceRefresh: 'not-a-date',
      now: NOW,
    }).prices).toBe(true);
  });
});
