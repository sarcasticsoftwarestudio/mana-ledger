const sameLocalDay = (value, now) => {
  if (!value) return false;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return false;
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
};

// Keep the launch-time network work predictable. Collection-backed sources
// refresh together on the first open of a local calendar day. Briefing also
// joins that pass, while retaining its own stale/parser-upgrade trigger for
// empty collections and same-day app upgrades.
export function startupRefreshPlan({
  hasCards = false,
  lastPriceRefresh = null,
  briefingNeedsRefresh = false,
  now = new Date(),
} = {}) {
  const collectionRefresh = !!hasCards && !sameLocalDay(lastPriceRefresh, now);
  return {
    briefing: !!briefingNeedsRefresh || collectionRefresh,
    prices: collectionRefresh,
    secretLair: collectionRefresh,
    precons: collectionRefresh,
  };
}
