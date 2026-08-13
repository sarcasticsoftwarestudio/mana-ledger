const SETTINGS_KEY = 'briefing_user_state';
const STATE_VERSION = 1;

let data = {
  version: STATE_VERSION,
  read: {},
  saved: [],
  corrections: {},
  lastOpenedAt: null,
};
let sessionCutoff = null;
let sessionStarted = false;
const sessionUpdated = new Set();
let persistQueue = Promise.resolve();

const iso = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

const cleanCorrection = row => ({
  scryfallId: String(row?.scryfallId || '').trim().toLowerCase().slice(0, 60),
  name: String(row?.name || '').trim().slice(0, 220),
  correctedAt: iso(row?.correctedAt) || new Date().toISOString(),
});

function sanitize(parsed = {}) {
  const read = {};
  for (const [url, value] of Object.entries(parsed.read || {})) {
    const when = iso(value);
    if (url && when) read[String(url)] = when;
  }
  const corrections = {};
  for (const [url, values] of Object.entries(parsed.corrections || {})) {
    if (!values || typeof values !== 'object') continue;
    const cleaned = {};
    for (const [key, value] of Object.entries(values)) {
      const row = cleanCorrection(value);
      if (key && row.scryfallId) cleaned[String(key)] = row;
    }
    if (Object.keys(cleaned).length) corrections[String(url)] = cleaned;
  }
  return {
    version: STATE_VERSION,
    read,
    saved: [...new Set((Array.isArray(parsed.saved) ? parsed.saved : []).map(String).filter(Boolean))].slice(0, 500),
    corrections,
    lastOpenedAt: iso(parsed.lastOpenedAt),
  };
}

function persist() {
  const snapshot = JSON.stringify(data);
  persistQueue = persistQueue
    .then(() => window.api?.settings?.set(SETTINGS_KEY, snapshot))
    .catch(error => { window.logger?.warn?.('Briefing', `Personal Briefing state could not be saved: ${error.message}`); });
  return persistQueue;
}

export async function loadBriefingState() {
  try {
    const raw = await window.api?.settings?.get(SETTINGS_KEY);
    data = sanitize(raw ? JSON.parse(raw) : {});
  } catch (error) {
    data = sanitize();
    window.logger?.warn?.('Briefing', `Personal Briefing state could not be loaded: ${error.message}`);
  }
  sessionCutoff = data.lastOpenedAt;
  sessionStarted = false;
  sessionUpdated.clear();
  persistQueue = Promise.resolve();
}

export function beginBriefingSession() {
  if (sessionStarted) return;
  sessionStarted = true;
  sessionCutoff = data.lastOpenedAt;
  data.lastOpenedAt = new Date().toISOString();
  void persist();
}

export function briefingCardKey(card, index = 0) {
  if (card?.correctionKey) return String(card.correctionKey);
  const image = String(card?.imageUrl || '').trim();
  if (image) return `image:${image}`;
  const name = String(card?.name || card?.displayName || '').trim().toLowerCase();
  return `card:${name || index}`;
}

export function briefingCorrection(url, key) {
  return data.corrections?.[url]?.[key] || null;
}

export function applyBriefingCorrections(article) {
  if (!article) return article;
  const corrections = data.corrections?.[article.url] || {};
  return {
    ...article,
    embeddedCards: (article.embeddedCards || []).map((card, index) => {
      const correction = corrections[briefingCardKey(card, index)];
      return correction ? {
        ...card,
        scryfallId: correction.scryfallId,
        matchedName: correction.name,
        manualCorrection: true,
      } : card;
    }),
    releaseNoteCards: (article.releaseNoteCards || []).map((card, index) => {
      const correction = corrections[briefingCardKey(card, index)];
      return correction ? {
        ...card,
        scryfallId: correction.scryfallId,
        matchedName: correction.name,
        manualCorrection: true,
      } : card;
    }),
  };
}

export async function setBriefingCorrection(url, key, card) {
  if (!url || !key || !card?.scryfallId) return;
  data.corrections[url] ||= {};
  data.corrections[url][key] = cleanCorrection({ ...card, correctedAt: new Date().toISOString() });
  await persist();
}

export async function clearBriefingCorrection(url, key) {
  if (!data.corrections?.[url]?.[key]) return;
  delete data.corrections[url][key];
  if (!Object.keys(data.corrections[url]).length) delete data.corrections[url];
  await persist();
}

const articleFreshAt = article => iso(article?.contentUpdatedAt || article?.discoveredAt || article?.publishedAt);

export function articleIsRead(article) {
  const readAt = iso(data.read?.[article?.url]);
  const freshAt = articleFreshAt(article);
  return !!readAt && (!freshAt || readAt >= freshAt);
}

export function articleIsUpdated(article) {
  const updatedAt = iso(article?.contentUpdatedAt);
  return sessionUpdated.has(article?.url) || (!!updatedAt && !articleIsRead(article));
}

export function articleIsNew(article) {
  const discoveredAt = iso(article?.discoveredAt);
  return !!discoveredAt && !!sessionCutoff && discoveredAt > sessionCutoff;
}

export function articleIsSaved(articleOrUrl) {
  const url = typeof articleOrUrl === 'string' ? articleOrUrl : articleOrUrl?.url;
  return !!url && data.saved.includes(url);
}

export function briefingSavedUrls() { return [...data.saved]; }

export async function markBriefingArticleRead(article) {
  if (!article?.url || articleIsRead(article)) return false;
  if (article.contentUpdatedAt) sessionUpdated.add(article.url);
  data.read[article.url] = new Date().toISOString();
  await persist();
  return true;
}

export async function markAllBriefingRead(articles) {
  const now = new Date().toISOString();
  for (const article of articles || []) if (article?.url) data.read[article.url] = now;
  await persist();
}

export async function toggleBriefingSaved(url) {
  if (!url) return false;
  data.saved = data.saved.includes(url) ? data.saved.filter(value => value !== url) : [...data.saved, url];
  await persist();
  return data.saved.includes(url);
}

export function briefingStateSnapshot() {
  return { ...data, sessionCutoff };
}
