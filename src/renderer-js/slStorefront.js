// Official Secret Lair storefront discovery.
//
// Most Secret Lair cards live in Scryfall's SLD set, but unusual storefront
// products can receive their own set code. The storefront is the authority for
// whether a product belongs here; Scryfall supplies the stable code, release
// date, and card catalog after a conservative name match.

import { netFetch, today } from './utils.js';

const STOREFRONT_URL = 'https://secretlair.wizards.com/us/en';
const SCRYFALL_SETS_URL = 'https://api.scryfall.com/sets';
const SETTINGS_KEY = 'sl_storefront_data';

const clean = (value, max = 300) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
const decode = value => String(value || '')
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&amp;/gi, '&').replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
  .replace(/&trade;/gi, '™').replace(/&reg;/gi, '®')
  .replace(/&#(\d+);/g, (_match, number) => String.fromCodePoint(Number(number)))
  .replace(/&#x([0-9a-f]+);/gi, (_match, number) => String.fromCodePoint(parseInt(number, 16)));
const norm = value => clean(decode(value), 300).toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[™®©]/g, '').replace(/[^a-z0-9]+/g, '');
const safeCode = value => clean(value, 12).toLowerCase().replace(/[^a-z0-9]/g, '');
const cleanTitle = value => clean(decode(value)
  .replace(/\\["']/g, match => match.slice(1)).replace(/\\\//g, '/')
  .replace(/<[^>]+>/g, ' '), 240);
const safeStoreUrl = (value, fallbackId = '') => {
  if (!value && fallbackId) return `https://secretlair.wizards.com/us/#${encodeURIComponent(fallbackId)}`;
  try {
    const url = new URL(String(value || ''), STOREFRONT_URL);
    if (url.protocol === 'https:' && url.hostname === 'secretlair.wizards.com') return url.toString();
  } catch { /* use the verified storefront fallback */ }
  return fallbackId ? `https://secretlair.wizards.com/us/#${encodeURIComponent(fallbackId)}` : STOREFRONT_URL;
};

const sanitizeProduct = value => ({
  title: cleanTitle(value?.title),
  url: safeStoreUrl(value?.url, clean(value?.id, 120)),
  id: clean(value?.id, 120).replace(/[^a-z0-9_-]/gi, ''),
});

const sanitizeSpecialSet = value => ({
  code: safeCode(value?.code),
  name: clean(value?.name, 180),
  releasedAt: clean(value?.releasedAt || value?.released_at, 10),
  setType: clean(value?.setType || value?.set_type, 40).toLowerCase(),
  cardCount: Math.max(0, Number(value?.cardCount ?? value?.card_count) || 0),
  storeTitle: cleanTitle(value?.storeTitle),
  storeUrl: safeStoreUrl(value?.storeUrl),
  scryfallUri: /^https:\/\/scryfall\.com\//i.test(value?.scryfallUri || value?.scryfall_uri || '')
    ? String(value.scryfallUri || value.scryfall_uri) : '',
});

export function parseSecretLairStorefrontHtml(html) {
  const source = String(html || '');
  const upcomingAt = source.search(/<section\b[^>]*id=["']coming-soon["']/i);
  if (upcomingAt < 0) return [];
  const upcoming = source.slice(upcomingAt);
  const blocks = upcoming.split(/(?=<div\b[^>]*class=["'][^"']*home-notify_me-container\b)/i).slice(1);
  const products = [];
  const seen = new Set();

  for (const block of blocks) {
    const opening = block.match(/^<div\b[^>]*>/i)?.[0] || '';
    const id = clean(opening.match(/\bid=["']([^"']+)/i)?.[1], 120).replace(/[^a-z0-9_-]/gi, '');
    const titleAttr = [...block.matchAll(/\balt=["']([^"']+)["']/gi)]
      .map(match => cleanTitle(match[1]))
      .find(value => value && !/^(?:secret lair|wizards of the coast)$/i.test(value));
    const notifyTitle = cleanTitle(block.match(/notifyMeCall\((?:&quot;|["'])(.*?)(?:&quot;|["'])\s*,/i)?.[1]);
    const descriptionTitle = cleanTitle(block.match(/Want to know when\s+([\s\S]{1,260}?)\s+goes on sale\?/i)?.[1]);
    const title = descriptionTitle || notifyTitle || titleAttr;
    const key = norm(title);
    if (!title || !key || seen.has(key)) continue;
    seen.add(key);
    products.push(sanitizeProduct({ title, id, url: id ? `https://secretlair.wizards.com/us/#${id}` : STOREFRONT_URL }));
  }
  return products;
}

const SET_NAME_STOPWORDS = new Set(['secret', 'lair', 'magic', 'the', 'gathering', 'drop', 'superdrop', 'set']);
const nameTokens = value => clean(decode(value), 300).toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[™®©]/g, '').split(/[^a-z0-9]+/).filter(token => token && !SET_NAME_STOPWORDS.has(token));

function matchScore(productTitle, setName) {
  const productNorm = norm(productTitle);
  const setNorm = norm(setName);
  if (!productNorm || !setNorm) return 0;
  let score = productNorm === setNorm ? 100 : (productNorm.includes(setNorm) ? 80 : 0);
  const setTokens = [...new Set(nameTokens(setName))];
  const productTokens = new Set(nameTokens(productTitle));
  if (setTokens.length && setTokens.every(token => productTokens.has(token))) score = Math.max(score, 60 + setTokens.length);
  return score;
}

export function matchStorefrontProductsToScryfallSets(products, sets, asOf = today()) {
  const storeProducts = (Array.isArray(products) ? products : []).map(sanitizeProduct).filter(item => item.title);
  const candidates = (Array.isArray(sets) ? sets : []).filter(set => {
    const code = safeCode(set?.code);
    const releaseDate = clean(set?.released_at || set?.releasedAt, 10);
    if (!code || code === 'sld' || !set?.name || !releaseDate || releaseDate < asOf || set?.digital === true) return false;
    // A storefront title can overlap an ordinary premier set (for example, a
    // Universes Beyond property). SL-prefixed codes are intrinsically strong;
    // otherwise only supplemental product-like Scryfall set types qualify.
    const type = clean(set?.set_type || set?.setType, 40).toLowerCase();
    return code.startsWith('sl') || ['box', 'memorabilia', 'promo', 'arsenal', 'funny', 'token'].includes(type);
  });
  const matches = [];

  for (const set of candidates) {
    const ranked = storeProducts.map(product => ({ product, score: matchScore(product.title, set.name) }))
      .filter(item => item.score >= 60)
      .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title));
    if (!ranked.length) continue;
    const best = ranked[0];
    matches.push(sanitizeSpecialSet({
      ...set,
      releasedAt: set.released_at || set.releasedAt,
      setType: set.set_type || set.setType,
      cardCount: set.card_count ?? set.cardCount,
      storeTitle: best.product.title,
      storeUrl: best.product.url,
      scryfallUri: set.scryfall_uri || set.scryfallUri,
    }));
  }

  return matches.filter(item => item.code && item.name && item.releasedAt && item.storeTitle)
    .sort((a, b) => a.releasedAt.localeCompare(b.releasedAt) || a.name.localeCompare(b.name));
}

let storefrontData = null; // { fetchedAt, products, specialSets }

const sanitizeCache = value => ({
  fetchedAt: clean(value?.fetchedAt, 40),
  products: (Array.isArray(value?.products) ? value.products : []).map(sanitizeProduct).filter(item => item.title),
  specialSets: (Array.isArray(value?.specialSets) ? value.specialSets : [])
    .map(sanitizeSpecialSet).filter(item => item.code && item.name && item.releasedAt && item.storeTitle),
});

export async function loadSlStorefrontFromSettings() {
  try {
    const raw = await window.api?.settings?.get(SETTINGS_KEY);
    if (raw) storefrontData = sanitizeCache(JSON.parse(raw));
  } catch (error) {
    window.logger?.warn?.('SL', `storefront cache load failed: ${error.message}`);
  }
}

export async function refreshSlStorefrontData(opts = {}) {
  try {
    const storefrontResponse = await netFetch(STOREFRONT_URL, { headers: { Accept: 'text/html' } });
    if (!storefrontResponse.ok) throw new Error(`HTTP ${storefrontResponse.status} from secretlair.wizards.com`);
    const products = parseSecretLairStorefrontHtml(await storefrontResponse.text());
    if (!products.length) throw new Error('no upcoming storefront products parsed — storefront layout changed?');

    const setsResponse = await netFetch(SCRYFALL_SETS_URL, { headers: { Accept: 'application/json' } });
    if (!setsResponse.ok) throw new Error(`HTTP ${setsResponse.status} from Scryfall set catalog`);
    const payload = await setsResponse.json();
    const specialSets = matchStorefrontProductsToScryfallSets(products, payload?.data || [], today());
    storefrontData = sanitizeCache({ fetchedAt: new Date().toISOString(), products, specialSets });
    await window.api?.settings?.set(SETTINGS_KEY, JSON.stringify(storefrontData));
    window.logger?.success?.('SL', `Official storefront: ${products.length} upcoming product${products.length === 1 ? '' : 's'} · ${specialSets.length} standalone Scryfall set${specialSets.length === 1 ? '' : 's'}`);
    return true;
  } catch (error) {
    if (!opts.silent) window.logger?.warn?.('SL', `official storefront sync failed (using last good data): ${error.message}`);
    return false;
  }
}

export function slStorefrontSpecialSets() { return storefrontData?.specialSets || []; }
export function slStorefrontInfo() {
  return storefrontData ? {
    fetchedAt: storefrontData.fetchedAt,
    productCount: storefrontData.products.length,
    specialSetCount: storefrontData.specialSets.length,
  } : null;
}
