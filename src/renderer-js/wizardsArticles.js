// General Wizards.com article ingestion for the Briefing workspace.
//
// The base parser intentionally understands ordinary article structure rather
// than one page template: metadata, headings, prose, links and PDFs are always
// retained. Small adapters then add release-note cards/rulings or Secret Lair
// sale context. If an adapter stops matching, the generic article remains
// useful and the last-known-good cache is not discarded.

import { parseAnnouncementDetailHtml, sanitizeAnnouncementRow } from './slAnnouncements.js';
import { netFetch } from './utils.js';

const FEED_URL = 'https://magic.wizards.com/en/news';
const SETTINGS_KEY = 'wizards_article_data';
const LEGACY_SL_SETTINGS_KEY = 'sl_announcement_data';
const PARSER_VERSION = 3;
const MAX_ARTICLES = 24;
const MAX_CACHED_ARTICLES = 120;
const MAX_SECTIONS = 36;
const MAX_ARTICLE_CARDS = 500;
const GENERIC_LINK_TEXT = /^(?:learn more|read more|details|view article|feature|announcements?)$/i;
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
  .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)));

const visibleHtml = html => String(html || '')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');

const htmlText = html => clean(decode(String(html || '')
  .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')));

const absoluteUrl = href => {
  const raw = decode(href).trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://magic.wizards.com');
    if (url.hostname !== 'magic.wizards.com') return url.toString();
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch { return ''; }
};

const cleanList = (values, maxItems, maxLength) => [...new Set((Array.isArray(values) ? values : [])
  .map(value => clean(value, maxLength)).filter(Boolean))].slice(0, maxItems);

const normalizeName = value => clean(value).toLowerCase()
  .replace(/[’‘]/g, "'")
  .replace(/\s*\/\/\s*/g, ' // ')
  .replace(/[^a-z0-9/' -]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const articlePath = url => {
  try {
    const path = new URL(url, 'https://magic.wizards.com').pathname;
    const match = path.match(/^\/en\/news\/([^/]+)\/([^/]+)\/?$/i);
    if (!match) return null;
    return { category: match[1].toLowerCase(), slug: match[2] };
  } catch { return null; }
};

function validatedArticleUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || url.hostname !== 'magic.wizards.com' || !articlePath(url.toString())) {
      throw new Error('not a Wizards news article');
    }
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('Enter a full magic.wizards.com/en/news article URL.');
  }
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const forward = String(html || '').match(new RegExp(`<meta\\b[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i'));
  if (forward) return clean(decode(forward[1]), 1000);
  const reverse = String(html || '').match(new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`, 'i'));
  return reverse ? clean(decode(reverse[1]), 1000) : '';
}

function jsonLdString(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html || '').match(new RegExp(`"${escaped}"\\s*:\\s*"([^"]+)"`, 'i'));
  if (!match) return '';
  return clean(decode(match[1].replace(/\\u([0-9a-f]{4})/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))), 1000);
}

function jsonLdAuthor(html) {
  const match = String(html || '').match(/"author"\s*:\s*(?:\[\s*)?\{[\s\S]{0,700}?"name"\s*:\s*"([^"]+)"/i);
  return match ? clean(decode(match[1]), 160) : '';
}

function contentRegion(html) {
  const source = visibleHtml(html);
  const start = source.search(/<h1\b/i);
  const footer = source.search(/<footer\b|<h[1-4]\b[^>]*>\s*Magic:\s*The Gathering Footer/i);
  return source.slice(start >= 0 ? start : 0, footer > start ? footer : source.length);
}

function insideExcludedContainer(lowerSource, index) {
  return ['a', 'nav', 'aside', 'footer'].some(tag => lowerSource.lastIndexOf(`<${tag}`, index) > lowerSource.lastIndexOf(`</${tag}`, index));
}

function contentBlocks(html) {
  const region = contentRegion(html);
  const lowerRegion = region.toLowerCase();
  return [...region.matchAll(/<(h[1-4]|p|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(match => ({ tag: match[1].toLowerCase(), text: htmlText(match[2]), index: match.index || 0 }))
    .filter(block => block.text && !insideExcludedContainer(lowerRegion, block.index));
}

function attributeValue(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag || '').match(new RegExp(`\\b${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decode(match[2]) : '';
}

function safeArticleImageUrl(value) {
  const raw = decode(value).trim();
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw, 'https://magic.wizards.com');
    if (url.protocol !== 'https:' || !['media.wizards.com', 'images.ctfassets.net'].includes(url.hostname)) return '';
    return url.toString();
  } catch { return ''; }
}

function canonicalCaptionName(value) {
  return htmlText(value)
    .replace(/\s+as\s+["“][\s\S]*$/i, '')
    .replace(/\s+tokens?$/i, '')
    .trim();
}

function headingAt(blocks, index) {
  let heading = '';
  for (const block of blocks) {
    if (block.index > index) break;
    if (/^h[2-4]$/.test(block.tag)) heading = block.text;
  }
  return heading;
}

export function parseEmbeddedCardImages(html, title = '') {
  const region = contentRegion(html);
  const lowerRegion = region.toLowerCase();
  const blocks = contentBlocks(region);
  const images = [];
  const seen = new Set();
  const add = image => {
    if (!image.imageUrl || seen.has(image.imageUrl)) return;
    seen.add(image.imageUrl);
    images.push(image);
  };

  for (const match of region.matchAll(/<magic-card\b(?:[^>"']+|"[^"]*"|'[^']*')*>/gi)) {
    if (insideExcludedContainer(lowerRegion, match.index || 0)) continue;
    const tag = match[0];
    const imageUrl = safeArticleImageUrl(attributeValue(tag, 'face'));
    const backImageUrl = safeArticleImageUrl(attributeValue(tag, 'back'));
    const displayName = htmlText(attributeValue(tag, 'caption'));
    const name = canonicalCaptionName(displayName);
    add({
      name,
      displayName: displayName || name || 'Card image',
      section: headingAt(blocks, match.index || 0),
      imageUrl,
      backImageUrl,
      sourceKind: 'magic-card',
      scryfallId: '',
      matchedName: '',
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
      backImageUrl: '',
      sourceKind: 'article-image',
      scryfallId: '',
      matchedName: '',
    });
  }
  return images.slice(0, MAX_ARTICLE_CARDS);
}

function parseSections(blocks) {
  const sections = [];
  let current = { heading: 'Overview', level: 1, blocks: [] };
  const flush = () => {
    if (!current.heading || !current.blocks.length) return;
    const paragraphs = cleanList(current.blocks, 8, 700);
    sections.push({
      heading: clean(current.heading, 220),
      level: current.level,
      summary: clean(paragraphs.slice(0, 3).join(' '), 1100),
      paragraphs,
    });
  };
  for (const block of blocks) {
    if (/^h[2-4]$/.test(block.tag)) {
      flush();
      current = { heading: block.text, level: Number(block.tag[1]), blocks: [] };
    } else if (block.tag !== 'h1') {
      current.blocks.push(block.text);
    }
  }
  flush();
  return sections.filter(section => !/^Magic:\s*The Gathering Footer$/i.test(section.heading)).slice(0, MAX_SECTIONS);
}

function extractCardNameFromRulesBlock(value) {
  const text = clean(value, 1800);
  if (!text || text.length < 12) return '';
  const type = '(?:(?:Legendary|Basic|Snow|World)\\s+)?(?:Artifact|Creature|Enchantment|Instant|Sorcery|Land|Planeswalker|Battle)';
  const match = text.match(new RegExp(`^(.{1,150}?)\\s+(?:(?:\\{[^}]+\\})+\\s+)?${type}(?:\\s|—|-)`, 'i'));
  if (!match) return '';
  const name = clean(match[1], 150).replace(/\s+\/\/\s+.*$/, '').trim();
  if (!name || /^(?:the|a|an)$/i.test(name)) return '';
  return name;
}

export function parseReleaseNoteCards(html) {
  const blocks = contentBlocks(html);
  const cards = [];
  let inCardNotes = false;
  let current = null;
  let section = '';
  for (const block of blocks) {
    if (/^h2$/.test(block.tag)) {
      if (/card-specific notes/i.test(block.text)) {
        inCardNotes = true;
        section = /alchemy/i.test(block.text) ? 'Alchemy card-specific notes' : 'Card-specific notes';
        current = null;
      } else {
        inCardNotes = false;
        current = null;
      }
      continue;
    }
    if (!inCardNotes) continue;
    if (/^h[3-4]$/.test(block.tag)) {
      inCardNotes = false;
      current = null;
      continue;
    }
    if (block.tag === 'p' || block.tag === 'blockquote') {
      const name = extractCardNameFromRulesBlock(block.text);
      if (name) {
        current = { name, section, rulesText: clean(block.text, 1500), rulings: [] };
        cards.push(current);
      }
      continue;
    }
    if (block.tag === 'li' && current && current.rulings.length < 10) {
      const ruling = clean(block.text, 650);
      if (ruling) current.rulings.push(ruling);
    }
  }
  const seen = new Set();
  return cards.filter(card => {
    const key = normalizeName(card.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_ARTICLE_CARDS);
}

function mergeCardCandidates(...groups) {
  const byName = new Map();
  for (const card of groups.flat()) {
    const name = clean(card?.name, 180);
    const key = normalizeName(name);
    if (!key) continue;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, {
        name,
        section: clean(card?.section, 120),
        rulesText: clean(card?.rulesText, 1500),
        rulings: cleanList(card?.rulings, 10, 650),
      });
      continue;
    }
    existing.section ||= clean(card?.section, 120);
    existing.rulesText ||= clean(card?.rulesText, 1500);
    existing.rulings = cleanList([...(existing.rulings || []), ...(card?.rulings || [])], 10, 650);
  }
  return [...byName.values()].slice(0, MAX_ARTICLE_CARDS);
}

const stableSet = values => [...new Set(values.filter(Boolean))].sort();
const addedCount = (before, after) => {
  const previous = new Set(before);
  return after.filter(value => !previous.has(value)).length;
};

// User-facing change tracking intentionally compares durable article content,
// not transient Scryfall responses, so an API hiccup never labels an article
// as modified. The latest concise summary stays on the cached article.
export function summarizeArticleChanges(previous, next) {
  if (!previous?.url) return [];
  const changes = [];
  if ([previous.title, previous.summary, previous.author, previous.modifiedAt].join('\n')
      !== [next.title, next.summary, next.author, next.modifiedAt].join('\n')) {
    changes.push('Article details or summary changed');
  }

  const oldSections = stableSet((previous.sections || []).map(section => `${section.heading}|${section.summary}|${(section.paragraphs || []).join('|')}`));
  const newSections = stableSet((next.sections || []).map(section => `${section.heading}|${section.summary}|${(section.paragraphs || []).join('|')}`));
  if (oldSections.join('\n') !== newSections.join('\n')) {
    const added = addedCount(oldSections, newSections);
    changes.push(added ? `${added} section${added === 1 ? '' : 's'} added or revised` : 'Article sections revised');
  }

  const oldImages = stableSet((previous.embeddedCards || []).map(card => card.imageUrl));
  const newImages = stableSet((next.embeddedCards || []).map(card => card.imageUrl));
  if (oldImages.join('\n') !== newImages.join('\n')) {
    const added = addedCount(oldImages, newImages);
    changes.push(added ? `${added} card image${added === 1 ? '' : 's'} added` : 'Card images changed');
  }

  const oldCards = stableSet((previous.releaseNoteCards || []).map(card => normalizeName(card.name)));
  const newCards = stableSet((next.releaseNoteCards || []).map(card => normalizeName(card.name)));
  if (oldCards.join('\n') !== newCards.join('\n')) {
    const added = addedCount(oldCards, newCards);
    changes.push(added ? `${added} card${added === 1 ? '' : 's'} added` : 'Parsed card list changed');
  }

  const oldPdfs = stableSet((previous.pdfLinks || []).map(link => link.url));
  const newPdfs = stableSet((next.pdfLinks || []).map(link => link.url));
  if (oldPdfs.join('\n') !== newPdfs.join('\n')) changes.push('Official documents changed');
  return changes.slice(0, 5);
}

function applyArticleHistory(article, previous = null) {
  const now = new Date().toISOString();
  if (!previous) return sanitizeWizardsArticle({ ...article, discoveredAt: now, contentUpdatedAt: '', changeSummary: [] });
  const changes = summarizeArticleChanges(previous, article);
  return sanitizeWizardsArticle({
    ...article,
    discoveredAt: previous.discoveredAt || previous.publishedAt || now,
    contentUpdatedAt: changes.length ? now : previous.contentUpdatedAt,
    changeSummary: changes.length ? changes : previous.changeSummary,
  });
}

function findPdfLinks(html) {
  return [...String(html || '').matchAll(/<a\b[^>]*href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => ({ label: htmlText(match[2]) || 'Official PDF', url: absoluteUrl(match[1]) }))
    .filter(link => link.url)
    .slice(0, 12);
}

function inferSetCode(body, title, html = '') {
  const explicit = body.match(/\b([A-Z0-9]{2,6})\s+collector numbers?\s+\d/i)?.[1];
  if (explicit) return explicit.toUpperCase();
  const titled = title.match(/\[([A-Z0-9]{2,6})\]/)?.[1];
  if (titled) return titled.toUpperCase();
  const mediaPath = String(html || '').match(/media\.wizards\.com\/\d{4}\/([a-z0-9]{2,6})\//i)?.[1];
  return mediaPath && !/^images?$/i.test(mediaPath) ? mediaPath.toUpperCase() : '';
}

function inferCollectorNumbers(body, setCode) {
  if (!setCode) return [];
  const escaped = setCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const numbers = new Set();
  const pattern = new RegExp(`\\b${escaped}\\s+collector numbers?\\s+(\\d{1,4})(?:\\s*[-–—]\\s*(\\d{1,4}))?`, 'gi');
  for (const match of body.matchAll(pattern)) {
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start || end - start >= MAX_ARTICLE_CARDS) continue;
    for (let value = start; value <= end && numbers.size < MAX_ARTICLE_CARDS; value++) numbers.add(String(value));
  }
  return [...numbers];
}

export function classifyWizardsArticle(input = {}) {
  const title = clean(input.title).toLowerCase();
  const category = clean(input.category).toLowerCase();
  if (/banned\s+(?:and|&)\s+restricted|format check-in/.test(title)) return 'banned_restricted';
  if (/release\s+notes?/.test(title)) return 'release_notes';
  if (/secret\s+lair/.test(title)) return 'secret_lair';
  if (/update bulletin|rules? update/.test(title)) return 'rules_update';
  if (/what(?:'|’)s inside|prerelease guide|card image gallery|collecting |\ball (?:the )?.*cards?\b/.test(title)) return 'product_guide';
  if (category === 'announcements' && /secret\s+lair/.test(`${title} ${clean(input.summary)}`)) return 'secret_lair';
  if (category === 'announcements') return 'announcement';
  return category === 'making-magic' ? 'design' : 'feature';
}

export function parseWizardsFeedHtml(html) {
  const source = visibleHtml(html);
  const articleBlocks = source.match(/<article\b[\s\S]*?<\/article>/gi) || [];
  // Some Wizards landing-page modules use semantic <article> elements while
  // feature rails are plain divs. Scan both shapes and deduplicate by URL.
  const blocks = [...articleBlocks, source];
  const byUrl = new Map();
  for (const block of blocks) {
    const wholePage = block === source;
    const publishedAt = wholePage ? null : (block.match(/<time\b[^>]*datetime=["']([^"']+)/i)?.[1] || null);
    const summary = wholePage ? '' : htmlText(block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
    for (const match of block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const url = absoluteUrl(match[1]);
      const path = articlePath(url);
      if (!path || ['archive', 'search'].includes(path.category)) continue;
      const title = htmlText(match[2]);
      const existing = byUrl.get(url);
      const usefulTitle = title && !GENERIC_LINK_TEXT.test(title);
      const shouldReplace = !existing || (usefulTitle && (!existing.title || GENERIC_LINK_TEXT.test(existing.title) || title.length > existing.title.length));
      if (!shouldReplace) continue;
      byUrl.set(url, {
        ...(existing || {}),
        url,
        title: usefulTitle ? clean(title, 260) : (existing?.title || ''),
        category: path.category,
        publishedAt: existing?.publishedAt || publishedAt,
        summary: existing?.summary || clean(summary, 700),
      });
    }
  }
  return [...byUrl.values()].filter(row => row.title).slice(0, MAX_ARTICLES);
}

export function parseWizardsArticleHtml(html, seed = {}) {
  const source = visibleHtml(html);
  const blocks = contentBlocks(source);
  const h1 = blocks.find(block => block.tag === 'h1')?.text || '';
  const title = clean(h1 || metaContent(html, 'og:title') || seed.title || 'Wizards article', 260);
  const metaDescription = clean(metaContent(html, 'description') || metaContent(html, 'og:description'), 1000);
  const firstProse = blocks.find(block => block.tag === 'p' && block.text.length >= 55 && !/^(?:Compiled|Written) by\s+|^Document last modified\s+/i.test(block.text))?.text || '';
  const description = /^(?:Products Coming Soon|Coming Soon)(?:\s|$)/i.test(metaDescription)
    ? clean(seed.summary || firstProse, 1000)
    : clean(metaDescription || seed.summary || firstProse, 1000);
  const publishedAt = jsonLdString(html, 'datePublished')
    || String(html || '').match(/<time\b[^>]*datetime=["']([^"']+)/i)?.[1]
    || seed.publishedAt || null;
  const modifiedAt = jsonLdString(html, 'dateModified')
    || htmlText(source).match(/Document last modified\s+([^\n.]+)/i)?.[1]
    || null;
  const author = jsonLdAuthor(html)
    || blocks.find(block => block.tag === 'p' && /^(?:Compiled|Written) by\s+/i.test(block.text))?.text.replace(/^(?:Compiled|Written) by\s+/i, '')
    || '';
  const headings = blocks.filter(block => /^h[2-4]$/.test(block.tag)).map(block => block.text);
  const sections = parseSections(blocks);
  const bodySignal = `${description} ${headings.join(' ')} ${blocks.slice(0, 18).map(block => block.text).join(' ')}`;
  const category = seed.category || articlePath(seed.url || '')?.category || '';
  const kind = classifyWizardsArticle({ title, category, summary: bodySignal, headings });
  const embeddedCards = parseEmbeddedCardImages(source, title);
  const embeddedCandidates = embeddedCards.filter(card => card.name).map(card => ({ name: card.name, section: card.section }));
  const releaseNoteCards = mergeCardCandidates(parseReleaseNoteCards(source), embeddedCandidates);
  const articleBody = htmlText(contentRegion(source));
  const setCode = releaseNoteCards.length || embeddedCards.length ? inferSetCode(articleBody, title, source) : '';
  const collectorNumbers = setCode ? inferCollectorNumbers(articleBody, setCode) : [];
  const generic = {
    ...seed,
    url: absoluteUrl(seed.url || metaContent(html, 'og:url')),
    title,
    category,
    kind,
    summary: description || sections[0]?.summary || '',
    publishedAt,
    modifiedAt,
    author: clean(author, 160),
    heroImage: clean(metaContent(html, 'og:image'), 1000),
    pdfLinks: findPdfLinks(source),
    headings: cleanList(headings, 80, 240),
    sections,
    setCode,
    collectorNumbers,
    releaseNoteCards,
    embeddedCards,
    cards: [],
    unmatchedCards: releaseNoteCards.map(card => card.name),
    detailVersion: PARSER_VERSION,
    parserConfidence: h1 && sections.length ? 'high' : (h1 || description ? 'medium' : 'low'),
    evidence: {
      title: h1 ? 'article h1' : 'page metadata',
      publishedAt: jsonLdString(html, 'datePublished') ? 'structured metadata' : 'page time element',
      cards: collectorNumbers.length
        ? 'collector-number ranges + article card data'
        : (embeddedCards.length
          ? `${embeddedCards.length} Wizards card image${embeddedCards.length === 1 ? '' : 's'}${embeddedCandidates.length ? ' + exact-name candidates' : ''}`
          : (releaseNoteCards.length ? 'card-specific note blocks' : '')),
    },
  };
  if (kind !== 'secret_lair') return sanitizeWizardsArticle(generic);

  const secret = parseAnnouncementDetailHtml(html, seed);
  const secretSummary = /^(?:Products Coming Soon|Coming Soon)(?:\s|$)/i.test(secret.summary || '') ? generic.summary : secret.summary;
  const revealedCandidates = (secret.revealedDrops || []).flatMap(drop => (drop.cards || []).map(card => ({ name: card.name, section: drop.name })));
  const secretCandidates = mergeCardCandidates(releaseNoteCards, revealedCandidates);
  return sanitizeWizardsArticle({
    ...generic,
    ...secret,
    summary: secretSummary || generic.summary,
    kind: 'secret_lair',
    category,
    releaseNoteCards: secretCandidates,
    unmatchedCards: secretCandidates.map(card => card.name),
  });
}

function compactScryfallCard(card, candidate, method, confidence = 'exact') {
  const front = card.card_faces?.[0] || {};
  const images = card.image_uris || front.image_uris || {};
  return {
    id: clean(card.id, 60).toLowerCase(),
    name: clean(card.name || candidate.name, 220),
    sourceName: candidate.name,
    setCode: clean(card.set, 12).toUpperCase(),
    setName: clean(card.set_name, 220),
    collectorNumber: clean(card.collector_number, 40),
    rarity: clean(card.rarity, 30),
    manaCost: clean(card.mana_cost || front.mana_cost, 100),
    typeLine: clean(card.type_line || front.type_line, 260),
    oracleText: clean(card.oracle_text || (card.card_faces || []).map(face => face.oracle_text).filter(Boolean).join(' // '), 1800),
    artist: clean(card.artist || front.artist, 180),
    imageSmall: clean(images.small || images.normal, 1000),
    imageNormal: clean(images.normal || images.large || images.small, 1000),
    rulesText: candidate.rulesText,
    rulings: cleanList(candidate.rulings, 10, 650),
    noteSection: candidate.section,
    match: { method, confidence, sourceName: candidate.name },
  };
}

async function fetchScryfallCollection(identifiers) {
  const response = await netFetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifiers }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from Scryfall card collection`);
  return response.json();
}

export async function resolveWizardsArticleCards(article, fetchCollection = fetchScryfallCollection) {
  const candidates = Array.isArray(article?.releaseNoteCards) ? article.releaseNoteCards : [];
  const collectorNumbers = Array.isArray(article?.collectorNumbers) ? article.collectorNumbers : [];
  if (!candidates.length && !collectorNumbers.length) return sanitizeWizardsArticle(article);
  const resolved = [];
  // A named Secret Lair card can have several SLD printings. The Wizards image
  // remains the source-of-truth visual, while Scryfall is matched by card name
  // for hover/oracle details unless a collector number makes the printing exact.
  const nameSetCode = article.kind === 'secret_lair' ? '' : article.setCode;
  const requests = collectorNumbers.length && article.setCode
    ? collectorNumbers.map(collectorNumber => ({ collectorNumber, identifier: { collector_number: collectorNumber, set: article.setCode.toLowerCase() } }))
    : candidates.map(candidate => ({ candidate, identifier: nameSetCode
      ? { name: candidate.name, set: nameSetCode.toLowerCase() }
      : { name: candidate.name } }));
  const chunks = [];
  for (let i = 0; i < requests.length; i += 75) chunks.push(requests.slice(i, i + 75));
  try {
    for (const chunk of chunks) {
      const identifiers = chunk.map(request => request.identifier);
      const json = await fetchCollection(identifiers);
      const returned = Array.isArray(json?.data) ? json.data : [];
      for (const card of returned) {
        const candidate = candidates.find(item => {
          const wanted = normalizeName(item.name);
          const full = normalizeName(card?.name);
          const front = normalizeName(String(card?.name || '').split(' // ')[0]);
          return full === wanted || front === wanted;
        }) || { name: card.name, section: 'Set card', rulesText: '', rulings: [] };
        const method = collectorNumbers.length ? 'set + collector number' : (nameSetCode ? 'set + exact name' : 'exact card name');
        resolved.push(compactScryfallCard(card, candidate, method, collectorNumbers.length ? 'exact' : 'name'));
      }
    }
  } catch (error) {
    return sanitizeWizardsArticle({ ...article, cardMatchStatus: 'unavailable', cardMatchError: clean(error.message, 300) });
  }
  const matchedNames = new Set(resolved.map(card => normalizeName(card.sourceName)));
  const resolvedByName = new Map();
  for (const card of resolved) {
    resolvedByName.set(normalizeName(card.sourceName), card);
    resolvedByName.set(normalizeName(card.name), card);
    resolvedByName.set(normalizeName(String(card.name).split(' // ')[0]), card);
  }
  const embeddedCards = (article.embeddedCards || []).map(image => {
    const matched = image.name ? resolvedByName.get(normalizeName(image.name)) : null;
    return matched ? { ...image, scryfallId: matched.id, matchedName: matched.name } : image;
  });
  return sanitizeWizardsArticle({
    ...article,
    cards: resolved,
    embeddedCards,
    unmatchedCards: candidates.filter(card => !matchedNames.has(normalizeName(card.name))).map(card => card.name),
    cardMatchStatus: resolved.length === (collectorNumbers.length || candidates.length) ? 'complete' : 'partial',
  });
}

export function sanitizeWizardsArticle(row = {}) {
  const path = articlePath(row.url || '');
  const releaseNoteCards = (Array.isArray(row.releaseNoteCards) ? row.releaseNoteCards : []).map(card => ({
    name: clean(card?.name, 180),
    section: clean(card?.section, 120),
    rulesText: clean(card?.rulesText, 1500),
    rulings: cleanList(card?.rulings, 10, 650),
  })).filter(card => card.name).slice(0, MAX_ARTICLE_CARDS);
  const cards = (Array.isArray(row.cards) ? row.cards : []).map(card => ({
    ...card,
    id: clean(card?.id, 60).toLowerCase(),
    name: clean(card?.name, 220),
    sourceName: clean(card?.sourceName || card?.name, 220),
    setCode: clean(card?.setCode, 12).toUpperCase(),
    setName: clean(card?.setName, 220),
    collectorNumber: clean(card?.collectorNumber, 40),
    rarity: clean(card?.rarity, 30),
    manaCost: clean(card?.manaCost, 100),
    typeLine: clean(card?.typeLine, 260),
    oracleText: clean(card?.oracleText, 1800),
    artist: clean(card?.artist, 180),
    imageSmall: clean(card?.imageSmall, 1000),
    imageNormal: clean(card?.imageNormal, 1000),
    rulesText: clean(card?.rulesText, 1500),
    rulings: cleanList(card?.rulings, 10, 650),
    noteSection: clean(card?.noteSection, 120),
    match: card?.match && typeof card.match === 'object' ? {
      method: clean(card.match.method, 80), confidence: clean(card.match.confidence, 30), sourceName: clean(card.match.sourceName, 220),
    } : null,
  })).filter(card => card.id && card.name).slice(0, MAX_ARTICLE_CARDS);
  const embeddedCards = (Array.isArray(row.embeddedCards) ? row.embeddedCards : []).map(card => ({
    name: clean(card?.name, 180),
    displayName: clean(card?.displayName || card?.name, 240) || 'Card image',
    section: clean(card?.section, 160),
    imageUrl: safeArticleImageUrl(card?.imageUrl),
    backImageUrl: safeArticleImageUrl(card?.backImageUrl),
    sourceKind: card?.sourceKind === 'magic-card' ? 'magic-card' : 'article-image',
    scryfallId: clean(card?.scryfallId, 60).toLowerCase(),
    matchedName: clean(card?.matchedName, 220),
  })).filter(card => card.imageUrl).slice(0, MAX_ARTICLE_CARDS);
  const title = clean(row.title, 260) || 'Wizards article';
  const category = clean(row.category || path?.category, 60).toLowerCase();
  const kind = clean(row.kind, 60) || classifyWizardsArticle({ title, category, summary: row.summary, headings: row.headings });
  return {
    ...row,
    url: absoluteUrl(row.url),
    title,
    category,
    kind,
    summary: clean(row.summary, 1000),
    author: clean(row.author, 160),
    heroImage: clean(row.heroImage, 1000),
    setCode: clean(row.setCode, 12).toUpperCase(),
    collectorNumbers: cleanList(row.collectorNumbers, MAX_ARTICLE_CARDS, 20),
    headings: cleanList(row.headings, 80, 240),
    pdfLinks: (Array.isArray(row.pdfLinks) ? row.pdfLinks : []).map(link => ({ label: clean(link?.label, 120) || 'Official PDF', url: absoluteUrl(link?.url) })).filter(link => link.url).slice(0, 12),
    sections: (Array.isArray(row.sections) ? row.sections : []).map(section => ({
      heading: clean(section?.heading, 220), level: Math.max(1, Math.min(4, Number(section?.level) || 2)),
      summary: clean(section?.summary, 1100), paragraphs: cleanList(section?.paragraphs, 8, 700),
    })).filter(section => section.heading).slice(0, MAX_SECTIONS),
    releaseNoteCards,
    embeddedCards,
    cards,
    unmatchedCards: cleanList(row.unmatchedCards, MAX_ARTICLE_CARDS, 180),
    discoveredAt: clean(row.discoveredAt || row.publishedAt, 60),
    contentUpdatedAt: clean(row.contentUpdatedAt, 60),
    changeSummary: cleanList(row.changeSummary, 8, 180),
    cardMatchStatus: ['complete', 'partial', 'unavailable', 'pending'].includes(row.cardMatchStatus) ? row.cardMatchStatus : '',
    cardMatchError: clean(row.cardMatchError, 300),
    detailVersion: Math.max(0, Number(row.detailVersion) || 0),
    parserConfidence: ['high', 'medium', 'low'].includes(row.parserConfidence) ? row.parserConfidence : 'low',
    evidence: row.evidence && typeof row.evidence === 'object' ? {
      title: clean(row.evidence.title, 100), publishedAt: clean(row.evidence.publishedAt, 100), cards: clean(row.evidence.cards, 100),
    } : {},
  };
}

let articleData = null; // { fetchedAt, rows }

export async function loadWizardsArticlesFromSettings() {
  try {
    const raw = await window.api?.settings?.get(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.rows)) {
        const reclassify = (Number(parsed.parserVersion) || 0) < PARSER_VERSION;
        articleData = { ...parsed, rows: parsed.rows.map(row => sanitizeWizardsArticle(reclassify ? { ...row, kind: '' } : row)) };
      }
    }
    if (articleData?.rows?.length) return;

    // A new Briefing installation should still be useful offline. Seed it from
    // the old Secret Lair cache; the first successful general sync replaces it.
    const legacyRaw = await window.api?.settings?.get(LEGACY_SL_SETTINGS_KEY);
    if (!legacyRaw) return;
    const legacy = JSON.parse(legacyRaw);
    if (!Array.isArray(legacy?.rows)) return;
    const rows = legacy.rows.map(row => sanitizeWizardsArticle({
      ...sanitizeAnnouncementRow(row),
      category: 'announcements',
      kind: 'secret_lair',
      parserConfidence: 'medium',
      evidence: { title: 'legacy Secret Lair cache', publishedAt: 'legacy Secret Lair cache', cards: '' },
    }));
    if (rows.length) articleData = { fetchedAt: legacy.fetchedAt || null, rows, migratedFrom: LEGACY_SL_SETTINGS_KEY };
  } catch (error) {
    window.logger?.warn?.('Briefing', `Wizards article cache load failed: ${error.message}`);
  }
}

async function fetchArticle(seed, previous) {
  try {
    const response = await netFetch(seed.url, { headers: { Accept: 'text/html' } });
    if (!response.ok) return previous || sanitizeWizardsArticle(seed);
    let parsed = parseWizardsArticleHtml(await response.text(), seed);
    if (parsed.releaseNoteCards.length) parsed = await resolveWizardsArticleCards(parsed);
    return applyArticleHistory(parsed, previous);
  } catch { return previous || sanitizeWizardsArticle(seed); }
}

async function mapPool(values, concurrency, worker) {
  const out = new Array(values.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      out[index] = await worker(values[index], index);
    }
  });
  await Promise.all(runners);
  return out;
}

export async function refreshWizardsArticles(opts = {}) {
  try {
    const response = await netFetch(FEED_URL, { headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`HTTP ${response.status} from magic.wizards.com`);
    const seeds = parseWizardsFeedHtml(await response.text());
    if (seeds.length < 4) throw new Error(`only ${seeds.length} article links parsed — feed layout changed?`);
    const previousByUrl = new Map((articleData?.rows || []).map(row => [row.url, sanitizeWizardsArticle(row)]));
    const feedSeeds = seeds.slice(0, MAX_ARTICLES);
    const feedUrls = new Set(feedSeeds.map(seed => seed.url));
    const preserveUrls = new Set(Array.isArray(opts.preserveUrls) ? opts.preserveUrls : []);
    const importedSeeds = [...previousByUrl.values()]
      .filter(row => row.imported && row.url && !feedUrls.has(row.url))
      .slice(0, 12);
    const importedUrls = new Set(importedSeeds.map(row => row.url));
    const savedSeeds = [...previousByUrl.values()]
      .filter(row => preserveUrls.has(row.url) && !feedUrls.has(row.url) && !importedUrls.has(row.url))
      .slice(0, 40);
    const refreshSeeds = [...feedSeeds, ...importedSeeds, ...savedSeeds];
    const rows = await mapPool(refreshSeeds, 4, seed => fetchArticle(seed, previousByUrl.get(seed.url)));
    if (!rows.some(row => row?.title && row?.url)) throw new Error('article details did not validate');
    const currentUrls = new Set(rows.map(row => row.url));
    // The landing page is a moving window. Keep articles already discovered or
    // explicitly imported so a sync grows an archive instead of making older
    // release notes disappear.
    const retained = (articleData?.rows || []).filter(row => row?.url && !currentUrls.has(row.url));
    const savedRetained = retained.filter(row => preserveUrls.has(row.url));
    const ordinaryRetained = retained.filter(row => !preserveUrls.has(row.url));
    const cacheLimit = Math.max(MAX_CACHED_ARTICLES, rows.length + savedRetained.length);
    articleData = {
      fetchedAt: new Date().toISOString(),
      parserVersion: PARSER_VERSION,
      rows: [...rows, ...savedRetained, ...ordinaryRetained].slice(0, cacheLimit).map(sanitizeWizardsArticle),
    };
    await window.api?.settings?.set(SETTINGS_KEY, JSON.stringify(articleData));
    window.logger?.success?.('Briefing', `Wizards sync: ${articleData.rows.length} recent articles`);
    return true;
  } catch (error) {
    if (!opts.silent) window.logger?.warn?.('Briefing', `Wizards sync failed (using last good data): ${error.message}`);
    return false;
  }
}

export async function importWizardsArticle(value) {
  const url = validatedArticleUrl(value);
  const response = await netFetch(url, { headers: { Accept: 'text/html' } });
  if (!response.ok) throw new Error(`Wizards returned HTTP ${response.status}.`);
  let article = parseWizardsArticleHtml(await response.text(), {
    url,
    category: articlePath(url)?.category || '',
    imported: true,
  });
  if (!article.title || article.title === 'Wizards article') throw new Error('The article title could not be parsed.');
  if (article.releaseNoteCards.length) article = await resolveWizardsArticleCards(article);
  const previous = (articleData?.rows || []).find(row => row.url === url);
  article = applyArticleHistory({ ...article, imported: true }, previous);
  const others = (articleData?.rows || []).filter(row => row.url !== url);
  articleData = {
    fetchedAt: articleData?.fetchedAt || null,
    parserVersion: PARSER_VERSION,
    rows: [article, ...others].slice(0, MAX_CACHED_ARTICLES),
  };
  await window.api?.settings?.set(SETTINGS_KEY, JSON.stringify(articleData));
  window.logger?.success?.('Briefing', `Imported ${article.title}`);
  return article;
}

export async function retryWizardsArticleCards(url) {
  const index = (articleData?.rows || []).findIndex(row => row.url === url);
  if (index < 0) throw new Error('That article is no longer in the Briefing cache.');
  const article = articleData.rows[index];
  if (!article.releaseNoteCards?.length && !article.collectorNumbers?.length) {
    throw new Error('No named cards or collector-number ranges are available to retry.');
  }
  const resolved = await resolveWizardsArticleCards({ ...article, cardMatchStatus: 'pending', cardMatchError: '' });
  articleData.rows[index] = sanitizeWizardsArticle({
    ...resolved,
    discoveredAt: article.discoveredAt,
    contentUpdatedAt: article.contentUpdatedAt,
    changeSummary: article.changeSummary,
  });
  await window.api?.settings?.set(SETTINGS_KEY, JSON.stringify(articleData));
  return articleData.rows[index];
}

export function wizardsArticles() { return articleData?.rows || []; }
export function wizardsArticleInfo() {
  return articleData ? { fetchedAt: articleData.fetchedAt, count: articleData.rows.length, parserVersion: articleData.parserVersion || 0 } : null;
}
export function wizardsArticlesNeedRefresh(maxAgeMs = 24 * 60 * 60 * 1000) {
  if ((articleData?.parserVersion || 0) < PARSER_VERSION) return true;
  const fetched = articleData?.fetchedAt ? new Date(articleData.fetchedAt).getTime() : 0;
  return !fetched || !Number.isFinite(fetched) || Date.now() - fetched > maxAgeMs;
}
