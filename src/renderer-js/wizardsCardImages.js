// Shared extraction and sanitization for card artwork embedded in official
// Wizards articles. Briefing and Upcoming use the same source images, while
// Scryfall matches remain optional metadata rather than the displayed visual.

const MAX_ARTICLE_CARDS = 500;
const SERIALIZED_PAGE_DATA = /(?:window\.)?__(?:NUXT|NEXT_DATA)__|webpackChunk|publishedVersion|contentType|\\u00(?:22|2F|3A)/i;

const clean = (value, maxLength = 0) => {
  if (value == null) return '';
  let out = String(value).replace(/\s+/g, ' ').trim();
  const leakAt = out.search(/(?:window\.)?__(?:NUXT|NEXT_DATA)__\s*=/i);
  if (leakAt >= 0) out = out.slice(0, leakAt).trim();
  if (!out || SERIALIZED_PAGE_DATA.test(out)) return '';
  if (maxLength && out.length > maxLength) out = `${out.slice(0, maxLength).trimEnd()}…`;
  return out;
};

const decode = value => String(value || '')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
  .replace(/&trade;/gi, '™')
  .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)));

const visibleHtml = html => String(html || '')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');

const htmlText = html => clean(decode(String(html || '')
  .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')));

const contentRegion = html => {
  const source = visibleHtml(html);
  const start = source.search(/<h1\b/i);
  const footer = source.search(/<footer\b|<h[1-4]\b[^>]*>\s*Magic:\s*The Gathering Footer/i);
  return source.slice(start >= 0 ? start : 0, footer > start ? footer : source.length);
};

const insideExcludedContainer = (lowerSource, index) => ['a', 'nav', 'aside', 'footer']
  .some(tag => lowerSource.lastIndexOf(`<${tag}`, index) > lowerSource.lastIndexOf(`</${tag}`, index));

const contentBlocks = html => {
  const region = contentRegion(html);
  const lowerRegion = region.toLowerCase();
  return [...region.matchAll(/<(h[1-4]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(match => ({ tag: match[1].toLowerCase(), text: htmlText(match[2]), index: match.index || 0 }))
    .filter(block => block.text && !insideExcludedContainer(lowerRegion, block.index));
};

const attributeValue = (tag, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag || '').match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decode(match[2]) : '';
};

export function safeArticleImageUrl(value) {
  const raw = decode(value).trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw, 'https://magic.wizards.com');
    if (url.protocol !== 'https:' || !['media.wizards.com', 'images.ctfassets.net'].includes(url.hostname)) return '';
    return url.toString();
  } catch { return ''; }
}

const canonicalCaptionName = value => htmlText(value)
  .replace(/\s+as\s+["“][\s\S]*$/i, '')
  .replace(/\s+tokens?$/i, '')
  .trim();

const headingAt = (blocks, index) => {
  let heading = '';
  for (const block of blocks) {
    if (block.index > index) break;
    if (/^h[2-4]$/.test(block.tag)) heading = block.text;
  }
  return heading;
};

export function sanitizeWizardsCardImage(card = {}) {
  const imageUrl = safeArticleImageUrl(card.imageUrl);
  if (!imageUrl) return null;
  return {
    name: clean(card.name, 180),
    displayName: clean(card.displayName || card.name, 240) || 'Card image',
    section: clean(card.section, 160),
    imageUrl,
    backImageUrl: safeArticleImageUrl(card.backImageUrl),
    sourceKind: card.sourceKind === 'magic-card' ? 'magic-card' : 'article-image',
    scryfallId: clean(card.scryfallId, 60).toLowerCase(),
    matchedName: clean(card.matchedName, 220),
  };
}

export function parseEmbeddedCardImages(html, title = '') {
  const region = contentRegion(html);
  const lowerRegion = region.toLowerCase();
  const blocks = contentBlocks(region);
  const images = [];
  const seen = new Set();
  const add = image => {
    const cleanImage = sanitizeWizardsCardImage(image);
    if (!cleanImage || seen.has(cleanImage.imageUrl)) return;
    seen.add(cleanImage.imageUrl);
    images.push(cleanImage);
  };

  for (const match of region.matchAll(/<magic-card\b(?:[^>"']+|"[^"]*"|'[^']*')*>/gi)) {
    if (insideExcludedContainer(lowerRegion, match.index || 0)) continue;
    const tag = match[0];
    const displayName = htmlText(attributeValue(tag, 'caption'));
    const name = canonicalCaptionName(displayName);
    add({
      name,
      displayName: displayName || name || 'Card image',
      section: headingAt(blocks, match.index || 0),
      imageUrl: safeArticleImageUrl(attributeValue(tag, 'face')),
      backImageUrl: safeArticleImageUrl(attributeValue(tag, 'back')),
      sourceKind: 'magic-card',
    });
  }

  const cardImageArticle = /\bcards?\b|card image gallery/i.test(title);
  for (const match of region.matchAll(/<img\b[^>]*>/gi)) {
    if (insideExcludedContainer(lowerRegion, match.index || 0)) continue;
    const tag = match[0];
    const imageUrl = safeArticleImageUrl(attributeValue(tag, 'src') || attributeValue(tag, 'data-src'));
    if (!imageUrl || !/media\.wizards\.com$/i.test(new URL(imageUrl).hostname)) continue;
    const displayName = htmlText(attributeValue(tag, 'alt') || attributeValue(tag, 'title'));
    const genericArtwork = /^(?:artwork|card image|image)\s*\d+$/i.test(displayName);
    const name = genericArtwork ? '' : canonicalCaptionName(displayName);
    if (!name && !(cardImageArticle && genericArtwork)) continue;
    add({
      name,
      displayName: displayName || 'Card image',
      section: headingAt(blocks, match.index || 0),
      imageUrl,
      sourceKind: 'article-image',
    });
  }
  return images.slice(0, MAX_ARTICLE_CARDS);
}
