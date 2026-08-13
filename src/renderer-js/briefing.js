import {
  applyBriefingCorrections, articleIsNew, articleIsRead, articleIsSaved, articleIsUpdated,
  beginBriefingSession, briefingCardKey, briefingCorrection, clearBriefingCorrection,
  briefingSavedUrls, markAllBriefingRead, markBriefingArticleRead, setBriefingCorrection, toggleBriefingSaved,
} from './briefingState.js';
import { hideModal, promptText, showModal } from './modals.js';
import { render } from './render.js';
import { collection, ui } from './state.js';
import { autoSave } from './storage.js';
import { addToWantList, isCardWanted, wantItemByScryfall } from './wantlist.js';
import { esc, netFetch, toast } from './utils.js';
import {
  importWizardsArticle, refreshWizardsArticles, retryWizardsArticleCards,
  wizardsArticleInfo, wizardsArticles,
} from './wizardsArticles.js';

const KIND_LABELS = {
  release_notes: 'Release notes', secret_lair: 'Secret Lair',
  banned_restricted: 'Banned & restricted', rules_update: 'Rules update',
  product_guide: 'Product guide', announcement: 'Announcement', design: 'Design', feature: 'Feature',
};

const FILTERS = [
  ['all', 'All'], ['release_notes', 'Release notes'], ['announcement', 'Announcements'], ['secret_lair', 'Secret Lair'],
];

const readableDate = raw => {
  const iso = String(raw || '').slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw || 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])));
};

const kindLabel = kind => KIND_LABELS[kind] || 'Article';
const matchesKind = (article, filter) => !filter || filter === 'all'
  || (filter === 'announcement' ? article.kind === 'announcement' || article.category === 'announcements' : article.kind === filter);
const ownedQuantity = id => (collection.cards || []).filter(card => card.status !== 'sold' && (card.scryfallId || '').toLowerCase() === id).reduce((sum, card) => sum + (card.quantity || 1), 0);
const encoded = value => encodeURIComponent(JSON.stringify(value));
const decoded = value => {
  try { return JSON.parse(decodeURIComponent(String(value || ''))); } catch { return null; }
};

export const articleMatchesSearch = (article, value) => {
  const query = String(value || '').trim().toLowerCase();
  if (!query) return true;
  return [article.title, article.summary, article.author, article.category, kindLabel(article.kind), ...(article.headings || [])]
    .some(field => String(field || '').toLowerCase().includes(query));
};

const cardCount = article => article.embeddedCards?.length || article.cards?.length || article.releaseNoteCards?.length || 0;
const matchCompleteness = article => {
  const expected = article.embeddedCards?.length || article.collectorNumbers?.length || article.releaseNoteCards?.length || 0;
  const matched = article.embeddedCards?.length ? article.embeddedCards.filter(card => card.scryfallId).length : (article.cards?.length || 0);
  return expected ? matched / expected : 0;
};

export function briefingArticleMatchesFilters(article, filters = {}) {
  if (!matchesKind(article, filters.filter || 'all') || !articleMatchesSearch(article, filters.search)) return false;
  const status = filters.status || 'all';
  if (status === 'unread' && articleIsRead(article)) return false;
  if (status === 'updated' && !articleIsUpdated(article)) return false;
  if (status === 'new' && !articleIsNew(article)) return false;
  if (status === 'saved' && !articleIsSaved(article)) return false;
  if (filters.author && filters.author !== 'all' && article.author !== filters.author) return false;
  if (filters.setCode && filters.setCode !== 'all' && article.setCode !== filters.setCode) return false;
  const date = String(article.publishedAt || '').slice(0, 10);
  if (filters.dateFrom && (!date || date < filters.dateFrom)) return false;
  if (filters.dateTo && (!date || date > filters.dateTo)) return false;
  if (filters.hasCards === 'yes' && !cardCount(article)) return false;
  if (filters.hasCards === 'no' && cardCount(article)) return false;
  return true;
}

export function sortBriefingArticles(rows, sort = 'newest') {
  const values = [...rows];
  const date = article => String(article.publishedAt || '');
  if (sort === 'oldest') return values.sort((a, b) => date(a).localeCompare(date(b)) || a.title.localeCompare(b.title));
  if (sort === 'updated') return values.sort((a, b) => String(b.contentUpdatedAt || b.modifiedAt || b.publishedAt || '').localeCompare(String(a.contentUpdatedAt || a.modifiedAt || a.publishedAt || '')));
  if (sort === 'matches') return values.sort((a, b) => matchCompleteness(b) - matchCompleteness(a) || date(b).localeCompare(date(a)));
  return values.sort((a, b) => date(b).localeCompare(date(a)) || a.title.localeCompare(b.title));
}

export async function syncBriefing(opts = {}) {
  if (ui.briefing.syncing || ui.briefing.importing) return;
  ui.briefing.syncing = true;
  if (!opts.silent || ui.activeTab === 'briefing') render();
  try {
    const ok = await refreshWizardsArticles({ silent: !!opts.silent, preserveUrls: briefingSavedUrls() });
    if (!ok && !opts.silent) toast('Wizards Briefing sync failed — showing the last good cache.', 'error');
    return ok;
  } finally {
    ui.briefing.syncing = false;
    if (!opts.silent || ui.activeTab === 'briefing') render();
  }
}

export function showBriefingImportModal() {
  if (ui.briefing.syncing || ui.briefing.importing) return;
  promptText('Import Wizards article', 'https://magic.wizards.com/en/news/...', async value => {
    ui.briefing.importing = true;
    render();
    try {
      const article = await importWizardsArticle(value);
      ui.briefing.articleUrl = article.url;
      ui.briefing.filter = 'all';
      ui.briefing.view = cardCount(article) ? 'cards' : 'overview';
      toast(`Imported ${article.title}`, 'success');
    } catch (error) {
      toast(error.message || 'That Wizards article could not be imported.', 'error');
    } finally {
      ui.briefing.importing = false;
      render();
    }
  });
}

export function openBriefingArticle(url) {
  ui.briefing.articleUrl = url;
  ui.briefing.view = 'overview';
  ui.briefing.articleSearch = '';
  const article = wizardsArticles().find(row => row.url === url);
  if (article) void markBriefingArticleRead(article);
  render();
}

export async function toggleBriefingBookmark(url) {
  const saved = await toggleBriefingSaved(url);
  toast(saved ? 'Article saved' : 'Article removed from saved', 'success');
  render();
}

export async function markAllBriefingArticlesRead() {
  await markAllBriefingRead(wizardsArticles());
  toast('All Briefing articles marked read', 'success');
  render();
}

export async function retryBriefingCardMatches(url) {
  if (ui.briefing.matching) return;
  ui.briefing.matching = true;
  render();
  try {
    const article = await retryWizardsArticleCards(url);
    if (article.cardMatchStatus === 'unavailable') throw new Error(article.cardMatchError || 'Scryfall card matching is unavailable.');
    toast(`Card matching retried — ${article.cards?.length || 0} resolved`, 'success');
  } catch (error) {
    toast(error.message || 'Card matching could not be retried.', 'error');
  } finally {
    ui.briefing.matching = false;
    render();
  }
}

export function resetBriefingFilters() {
  Object.assign(ui.briefing, {
    filter: 'all', status: 'all', search: '', author: 'all', setCode: 'all',
    dateFrom: '', dateTo: '', hasCards: 'all', sort: 'newest', articleUrl: '', feedScroll: 0,
  });
  render();
}

export function jumpToNewestBriefingArticle() {
  const newest = sortBriefingArticles(wizardsArticles(), 'newest')[0];
  Object.assign(ui.briefing, {
    filter: 'all', status: 'all', search: '', author: 'all', setCode: 'all',
    dateFrom: '', dateTo: '', hasCards: 'all', sort: 'newest',
    articleUrl: newest?.url || '', articleSearch: '', view: 'overview', feedScroll: 0,
  });
  if (newest) void markBriefingArticleRead(newest);
  render();
}

function selectedArticle() {
  return applyBriefingCorrections(wizardsArticles().find(article => article.url === ui.briefing.articleUrl) || null);
}

function galleryCards(article) {
  if (article?.embeddedCards?.length) return article.embeddedCards;
  const rows = (article?.cards || []).map(card => ({
    name: card.name, displayName: card.name, section: card.noteSection,
    imageUrl: card.imageNormal || card.imageSmall, scryfallId: card.id, matchedName: card.name,
  })).filter(card => card.imageUrl);
  const seen = new Set(rows.map(card => card.scryfallId));
  for (const card of article?.releaseNoteCards || []) {
    const id = (card.scryfallId || '').toLowerCase();
    if (!id || seen.has(id)) continue;
    rows.push({
      ...card,
      correctionKey: briefingCardKey(card),
      displayName: card.matchedName || card.name,
      imageUrl: `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg`,
      scryfallId: id,
    });
    seen.add(id);
  }
  return rows;
}

function resolvedCard(article, id) {
  return (article.cards || []).find(card => card.id === id) || null;
}

function lightboxModel(arg) {
  const context = decoded(arg);
  if (!context) return null;
  const article = applyBriefingCorrections(wizardsArticles().find(row => row.url === context.url));
  const cards = galleryCards(article);
  const index = Math.max(0, Math.min(cards.length - 1, Number(context.index) || 0));
  return article && cards[index] ? { context, article, cards, index, image: cards[index] } : null;
}

export function showBriefingLightbox(arg) {
  const model = lightboxModel(arg);
  if (!model) return;
  const { article, cards, index, image } = model;
  const id = (image.scryfallId || '').toLowerCase();
  const card = id ? resolvedCard(article, id) : null;
  const owned = id ? ownedQuantity(id) : 0;
  const wanted = id ? isCardWanted(id) : false;
  const key = briefingCardKey(image, index);
  const correction = briefingCorrection(article.url, key);
  const previous = encoded({ url: article.url, index: (index - 1 + cards.length) % cards.length });
  const next = encoded({ url: article.url, index: (index + 1) % cards.length });
  const current = encoded({ url: article.url, index });
  showModal(`
    <div class="briefing-lightbox">
      <div class="briefing-lightbox-image"><img src="${esc(image.imageUrl)}" alt="${esc(image.displayName || image.name || 'Wizards article image')}" data-act="toggleBriefingLightboxZoom" data-imgerr="hide"></div>
      <aside>
        <span class="briefing-eyebrow">${esc(article.title)}</span>
        <h2>${esc(image.matchedName || image.name || image.displayName || 'Article image')}</h2>
        <p>${esc(image.section || 'Official Wizards card gallery')}</p>
        <div class="briefing-lightbox-state">
          ${id ? `<span class="${owned ? 'owned' : 'missing'}">${owned ? `Owned · ${owned}` : 'Missing'}</span><span>${wanted ? '★ Wanted' : 'Not on want list'}</span>` : '<span class="source">Source image · unmatched</span>'}
          ${image.manualCorrection ? '<span>Manual match</span>' : ''}
        </div>
        <div class="briefing-lightbox-actions">
          <button class="btn btn-primary" data-act="open-url" data-arg="${esc(image.imageUrl)}">Open original image ↗</button>
          <button class="btn" id="briefing-lightbox-zoom" data-act="toggleBriefingLightboxZoom">Zoom image</button>
          ${id ? `<button class="btn" data-slact="card-modal" data-arg="${esc(id)}">View card details</button><button class="btn" data-act="toggleBriefingCardWant" data-arg="${current}">${wanted ? '☆ Remove from want list' : '★ Add to want list'}</button>` : ''}
          <button class="btn" data-act="showBriefingMatchReview" data-arg="${current}">${id ? 'Correct card match' : 'Match this image'}</button>
          ${correction ? `<button class="btn btn-ghost" data-act="clearBriefingCardMatch" data-arg="${current}">Restore automatic match</button>` : ''}
        </div>
        <div class="briefing-lightbox-nav">
          <button class="btn btn-ghost" data-act="showBriefingLightbox" data-arg="${previous}" ${cards.length < 2 ? 'disabled' : ''}>← Previous</button>
          <span>${index + 1} / ${cards.length}</span>
          <button class="btn btn-ghost" data-act="showBriefingLightbox" data-arg="${next}" ${cards.length < 2 ? 'disabled' : ''}>Next →</button>
        </div>
      </aside>
    </div>`, 'xl');
}

export function toggleBriefingLightboxZoom() {
  const stage = document.querySelector('.briefing-lightbox-image');
  if (!stage) return;
  const zoomed = stage.classList.toggle('zoomed');
  const button = document.getElementById('briefing-lightbox-zoom');
  if (button) button.textContent = zoomed ? 'Fit image' : 'Zoom image';
}

export async function toggleBriefingCardWant(arg) {
  const model = lightboxModel(arg);
  if (!model?.image?.scryfallId) return;
  const id = model.image.scryfallId.toLowerCase();
  const existing = wantItemByScryfall(id);
  if (existing) collection.wantList = collection.wantList.filter(item => item.id !== existing.id);
  else {
    const card = resolvedCard(model.article, id);
    addToWantList({
      scryfallId: id, name: model.image.matchedName || model.image.name || card?.name || 'Briefing card',
      setCode: card?.setCode || '', setName: card?.setName || '', collectorNumber: card?.collectorNumber || '',
      dropName: model.article.kind === 'secret_lair' ? model.image.section : '', note: `From Briefing: ${model.article.title}`,
    }, { silent: true });
  }
  await autoSave();
  showBriefingLightbox(arg);
  toast(existing ? 'Removed from want list' : 'Added to want list', 'success');
}

export async function addBriefingMissingToWantList(url) {
  const article = applyBriefingCorrections(wizardsArticles().find(row => row.url === url));
  if (!article) return;
  let added = 0;
  for (const image of galleryCards(article)) {
    const id = (image.scryfallId || '').toLowerCase();
    if (!id || ownedQuantity(id) || isCardWanted(id)) continue;
    const card = resolvedCard(article, id);
    if (addToWantList({
      scryfallId: id, name: image.matchedName || image.name || card?.name || 'Briefing card',
      setCode: card?.setCode || '', setName: card?.setName || '', collectorNumber: card?.collectorNumber || '',
      dropName: article.kind === 'secret_lair' ? image.section : '', note: `From Briefing: ${article.title}`,
    }, { silent: true })) added++;
  }
  if (added) await autoSave();
  toast(added ? `Added ${added} missing card${added === 1 ? '' : 's'} to your want list` : 'No new matched missing cards to add', added ? 'success' : 'info');
  render();
}

export function showBriefingMatchReview(arg) {
  const context = decoded(arg);
  let model = lightboxModel(arg);
  if (!model && context?.candidateName) {
    const article = applyBriefingCorrections(wizardsArticles().find(row => row.url === context.url));
    const index = (article?.releaseNoteCards || []).findIndex(card => card.name === context.candidateName);
    const image = index >= 0 ? article.releaseNoteCards[index] : null;
    if (article && image) model = { article, image, index };
  }
  if (!model) return;
  const { article, image, index } = model;
  const label = image.matchedName || image.name || image.displayName || '';
  showModal(`
    <h2>Review card match</h2>
    <div class="briefing-match-review">
      ${image.imageUrl ? `<img src="${esc(image.imageUrl)}" alt="" data-imgerr="hide">` : '<div class="briefing-match-placeholder">No source image<br><small>Match the parsed card name instead.</small></div>'}
      <div><p>Search Scryfall and choose the exact printing for this Wizards image. Your correction stays local and survives future article syncs.</p>
      <input id="briefing-match-search" type="search" value="${esc(label)}" placeholder="Card name…" autocomplete="off">
      <div id="briefing-match-results" class="briefing-match-results"><span>Type at least two characters to search.</span></div></div>
    </div>`, 'wide');
  const input = document.getElementById('briefing-match-search');
  const results = document.getElementById('briefing-match-results');
  let timer = null;
  let token = 0;
  const search = async () => {
    const query = input.value.trim();
    if (query.length < 2) { results.innerHTML = '<span>Type at least two characters to search.</span>'; return; }
    const currentToken = ++token;
    results.innerHTML = '<span>Searching Scryfall…</span>';
    try {
      const response = await netFetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints&order=released`);
      if (!response.ok) throw new Error(`Scryfall HTTP ${response.status}`);
      const rows = (await response.json()).data || [];
      if (currentToken !== token) return;
      results.innerHTML = rows.slice(0, 18).map(card => {
        const face = card.card_faces?.[0] || {};
        const thumb = card.image_uris?.small || face.image_uris?.small || '';
        return `<button type="button" data-sid="${esc(card.id)}" data-name="${esc(card.name)}"><img src="${esc(thumb)}" alt="" data-imgerr="hide"><span><strong>${esc(card.name)}</strong><small>${esc(card.set_name || '')} · ${esc((card.set || '').toUpperCase())} #${esc(card.collector_number || '?')}</small></span></button>`;
      }).join('') || '<span>No cards matched that search.</span>';
      results.querySelectorAll('button[data-sid]').forEach(button => button.addEventListener('click', async () => {
        await setBriefingCorrection(article.url, briefingCardKey(image, index), { scryfallId: button.dataset.sid, name: button.dataset.name });
        hideModal();
        render();
        toast(`Matched as ${button.dataset.name}`, 'success');
      }));
    } catch (error) {
      if (currentToken === token) results.innerHTML = `<span>Search failed: ${esc(error.message)}</span>`;
    }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 300); });
  input.focus();
  input.select();
  if (label.length >= 2) void search();
}

export async function clearBriefingCardMatch(arg) {
  const model = lightboxModel(arg);
  if (!model) return;
  await clearBriefingCorrection(model.article.url, briefingCardKey(model.image, model.index));
  hideModal();
  render();
  toast('Automatic card match restored', 'success');
}

export function attachBriefingListeners() {
  const feed = document.querySelector('.briefing-feed');
  if (feed) {
    feed.scrollTop = Number(ui.briefing.feedScroll) || 0;
    feed.addEventListener('scroll', () => { ui.briefing.feedScroll = feed.scrollTop; }, { passive: true });
  }
  const article = selectedArticle();
  if (article) void markBriefingArticleRead(article).then(changed => { if (changed && ui.activeTab === 'briefing') render(); });
}

function renderFeed(rows, selected) {
  const grouped = [];
  let currentMonth = '';
  for (const row of rows) {
    const month = String(row.publishedAt || '').slice(0, 7);
    if (month !== currentMonth) {
      currentMonth = month;
      const label = month && /^\d{4}-\d{2}$/.test(month)
        ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
        : 'Recent';
      grouped.push(`<div class="briefing-feed-month">${esc(label)}</div>`);
    }
    const flags = [articleIsNew(row) ? '<span class="briefing-feed-flag new">New</span>' : '', articleIsUpdated(row) ? '<span class="briefing-feed-flag updated">Updated</span>' : '', articleIsSaved(row) ? '<span class="briefing-feed-star">★</span>' : ''].filter(Boolean).join('');
    grouped.push(`
      <button type="button" class="briefing-feed-item${selected?.url === row.url ? ' active' : ''}${articleIsRead(row) ? '' : ' unread'}"
        data-act="openBriefingArticle" data-arg="${esc(row.url)}">
        <span class="briefing-feed-top"><span class="briefing-feed-kind kind-${esc(row.kind)}">${esc(kindLabel(row.kind))}</span><span>${flags}</span></span>
        <strong>${esc(row.title)}</strong>
        <small>${esc(readableDate(row.publishedAt))}${row.author ? ` · ${esc(row.author)}` : ''}</small>
      </button>`);
  }
  return grouped.join('');
}

function renderArticleTabs(article) {
  const view = ui.briefing.view || 'overview';
  const button = (id, label) => `<button type="button" class="briefing-tab${view === id ? ' active' : ''}" data-act="ui-set" data-path="briefing.view" data-val="${id}">${label}</button>`;
  const count = cardCount(article);
  const rulingCount = (article.cards || []).filter(card => card.rulings?.length).length || (article.releaseNoteCards || []).filter(card => card.rulings?.length).length;
  return `<div class="briefing-tabbar"><nav class="briefing-tabs" aria-label="Article sections">
    ${button('overview', 'Overview')}${count ? button('cards', `Cards · ${count}`) : ''}${article.sections?.length ? button('sections', `Sections · ${article.sections.length}`) : ''}${rulingCount ? button('rulings', `Card rulings · ${rulingCount}`) : ''}${button('diagnostics', 'Parsing details')}
  </nav><div class="briefing-article-search"><span>⌕</span><input id="briefingArticleSearch" type="search" placeholder="Search this article…" value="${esc(ui.briefing.articleSearch || '')}" data-act="ui-set" data-path="briefing.articleSearch" data-refocus="briefingArticleSearch" aria-label="Search within selected article"></div></div>`;
}

function renderOverview(article) {
  const embedded = article.embeddedCards || [];
  const cards = embedded.length ? embedded.filter(card => card.scryfallId).length : (article.cards?.length || 0);
  const expected = embedded.length || article.collectorNumbers?.length || article.releaseNoteCards?.length || 0;
  const sourceNotes = [article.parserConfidence ? `${article.parserConfidence} parser confidence` : '', article.evidence?.title ? `title: ${article.evidence.title}` : '', article.evidence?.cards ? `cards: ${article.evidence.cards}` : ''].filter(Boolean);
  return `${article.summary ? `<p class="briefing-summary">${esc(article.summary)}</p>` : ''}
    <div class="briefing-stat-grid"><div><span>Article type</span><strong>${esc(kindLabel(article.kind))}</strong></div><div><span>Parsed sections</span><strong>${article.sections?.length || 0}</strong></div><div><span>Card matches</span><strong>${expected ? `${cards} / ${expected}` : '—'}</strong></div>${article.setCode ? `<div><span>Set</span><strong>${esc(article.setCode)}</strong></div>` : ''}</div>
    ${article.headings?.length ? `<section class="briefing-outline"><h3>Article outline</h3><div>${article.headings.slice(0, 16).map(heading => `<span>${esc(heading)}</span>`).join('')}</div></section>` : ''}
    ${sourceNotes.length ? `<div class="briefing-evidence">${sourceNotes.map(note => `<span>${esc(note)}</span>`).join('')}</div>` : ''}`;
}

function cardState(card) {
  const id = (card.scryfallId || '').toLowerCase();
  const owned = id ? ownedQuantity(id) : 0;
  return { id, owned, wanted: id ? isCardWanted(id) : false };
}

function renderCards(article) {
  const allCards = galleryCards(article);
  let cards = [...allCards];
  const filter = ui.briefing.cardFilter || 'all';
  if (filter !== 'all') cards = cards.filter(card => {
    const state = cardState(card);
    if (filter === 'owned') return state.owned > 0;
    if (filter === 'missing') return !!state.id && !state.owned;
    if (filter === 'wanted') return state.wanted;
    if (filter === 'unmatched') return !state.id;
    return true;
  });
  if (!allCards.length) return `<div class="briefing-empty">${article.releaseNoteCards?.length ? `${article.releaseNoteCards.length} card names were parsed, but exact Scryfall matching is unavailable. Retry card matching to check again.` : 'No card list was detected in this article.'}</div>`;
  const matched = allCards.filter(card => card.scryfallId).length;
  const missingIds = new Set(allCards.map(card => (card.scryfallId || '').toLowerCase()).filter(id => id && !ownedQuantity(id) && !isCardWanted(id)));
  const filterButton = (value, label) => `<button class="btn ${filter === value ? 'btn-primary' : 'btn-ghost'}" data-act="ui-set" data-path="briefing.cardFilter" data-val="${value}">${label}</button>`;
  return `<div class="briefing-gallery-head"><div><strong>Cards in this article</strong><small>Hover for details, click for the full image viewer, or correct an uncertain match from the viewer.</small></div><span class="briefing-match ${matched === allCards.length ? 'complete' : 'partial'}">${matched} of ${allCards.length} matched</span></div>
    <div class="briefing-card-tools"><div>${filterButton('all', `All · ${allCards.length}`)}${filterButton('missing', 'Missing')}${filterButton('owned', 'Owned')}${filterButton('wanted', 'Wanted')}${filterButton('unmatched', 'Unmatched')}</div><button class="btn btn-ghost" data-act="addBriefingMissingToWantList" data-arg="${esc(article.url)}" ${missingIds.size ? '' : 'disabled'}>★ Add ${missingIds.size || ''} missing to want list</button><button class="btn btn-ghost" data-act="retryBriefingCardMatches" data-arg="${esc(article.url)}" ${ui.briefing.matching ? 'disabled' : ''}>${ui.briefing.matching ? '⏳ Matching…' : '↻ Retry unmatched'}</button></div>
    ${cards.length ? `<div class="briefing-card-grid">${cards.map(card => {
      const originalIndex = allCards.indexOf(card);
      const state = cardState(card);
      const resolved = state.id ? resolvedCard(article, state.id) : null;
      const confidence = card.manualCorrection ? 'Manual' : (resolved?.match?.confidence === 'exact' ? 'Exact' : (state.id ? 'Name match' : 'Source'));
      const label = card.matchedName || card.name || card.displayName || 'Article card image';
      const hover = state.id ? `data-scryfall-id="${esc(state.id)}"` : `data-source-image="${esc(card.imageUrl)}" data-source-label="${esc(label)}" data-source-section="${esc(card.section || '')}"`;
      return `<button type="button" class="gallery-card briefing-card${state.id ? '' : ' briefing-card-source'}" ${hover} data-act="showBriefingLightbox" data-arg="${encoded({ url: article.url, index: originalIndex })}" aria-label="Enlarge ${esc(label)}">
        <img src="${esc(card.imageUrl)}" alt="${esc(label)}" loading="lazy" data-imgerr="hide-card"><span class="briefing-card-label"><b>${esc(label)}</b>${card.section && card.section !== label ? `<small>${esc(card.section)}</small>` : ''}</span>
        <span class="briefing-card-confidence">${confidence}</span><span class="briefing-card-state ${state.owned ? 'owned' : state.wanted ? 'wanted' : state.id ? 'missing' : 'source'}">${state.owned ? `✓ ${state.owned}` : state.wanted ? '★' : state.id ? 'Missing' : 'Source'}</span>
      </button>`;
    }).join('')}</div>` : '<div class="briefing-empty">No cards match this gallery filter.</div>'}
    ${(article.unmatchedCards || []).filter(name => !briefingCorrection(article.url, briefingCardKey({ name }))).length ? `<div class="briefing-unmatched"><strong>Unresolved names</strong><span>${(article.unmatchedCards || []).filter(name => !briefingCorrection(article.url, briefingCardKey({ name }))).map(name => `<button class="btn btn-ghost" data-act="showBriefingMatchReview" data-arg="${encoded({ url: article.url, candidateName: name })}">${esc(name)} · Review</button>`).join('')}</span></div>` : ''}`;
}

function renderSections(article) {
  if (!article.sections?.length) return '<div class="briefing-empty">No structured sections were detected. The official article is still available from the source link.</div>';
  return `<div class="briefing-sections">${article.sections.map((section, index) => `<details${index < 2 ? ' open' : ''}><summary>${esc(section.heading)}</summary>${section.paragraphs?.length ? section.paragraphs.slice(0, 8).map(paragraph => `<p>${esc(paragraph)}</p>`).join('') : `<p>${esc(section.summary)}</p>`}</details>`).join('')}</div>`;
}

function renderRulings(article) {
  const cards = (article.cards?.length ? article.cards : article.releaseNoteCards || []).filter(card => card.rulings?.length);
  if (!cards.length) return '<div class="briefing-empty">No card-specific rulings were detected.</div>';
  return `<div class="briefing-rulings">${cards.map(card => `<details><summary>${card.imageSmall ? `<img src="${esc(card.imageSmall)}" alt="" loading="lazy" data-imgerr="hide">` : ''}<span><strong>${esc(card.name || card.sourceName)}</strong><small>${card.setCode ? `${esc(card.setCode)} · #${esc(card.collectorNumber || '?')}` : esc(card.noteSection || '')}</small></span><em>${card.rulings.length} note${card.rulings.length === 1 ? '' : 's'}</em></summary><ul>${card.rulings.map(ruling => `<li>${esc(ruling)}</li>`).join('')}</ul></details>`).join('')}</div>`;
}

function renderDiagnostics(article) {
  const embedded = article.embeddedCards || [];
  const named = embedded.filter(card => card.name).length;
  const matched = embedded.filter(card => card.scryfallId).length || article.cards?.length || 0;
  const info = wizardsArticleInfo();
  return `<div class="briefing-diagnostics">
    <div class="briefing-diagnostic-grid"><div><span>Metadata</span><strong>${article.title && article.publishedAt ? 'Complete' : 'Partial'}</strong><small>${esc(article.evidence?.title || 'fallback')} · ${esc(article.evidence?.publishedAt || 'fallback')}</small></div><div><span>Structure</span><strong>${article.sections?.length || 0} sections</strong><small>${article.headings?.length || 0} headings retained</small></div><div><span>Images</span><strong>${embedded.length}</strong><small>${named} named · ${embedded.length - named} unlabeled</small></div><div><span>Card resolution</span><strong>${matched} matched</strong><small>${article.unmatchedCards?.length || 0} unresolved · ${esc(article.cardMatchStatus || 'not requested')}</small></div></div>
    <section><h3>Parser evidence</h3><dl><dt>Overall confidence</dt><dd>${esc(article.parserConfidence)}</dd><dt>Parser version</dt><dd>${info?.parserVersion || article.detailVersion || '—'}</dd><dt>Title source</dt><dd>${esc(article.evidence?.title || 'Unknown')}</dd><dt>Date source</dt><dd>${esc(article.evidence?.publishedAt || 'Unknown')}</dd><dt>Card evidence</dt><dd>${esc(article.evidence?.cards || 'No card-specific evidence found')}</dd>${article.cardMatchError ? `<dt>Last match error</dt><dd class="error">${esc(article.cardMatchError)}</dd>` : ''}</dl></section>
    ${article.changeSummary?.length ? `<section><h3>Latest detected changes</h3><ul>${article.changeSummary.map(change => `<li>${esc(change)}</li>`).join('')}</ul></section>` : ''}
    <div class="briefing-diagnostic-actions"><button class="btn" data-act="retryBriefingCardMatches" data-arg="${esc(article.url)}" ${ui.briefing.matching ? 'disabled' : ''}>↻ Retry card matching only</button><button class="btn btn-ghost" data-act="syncBriefing">↻ Reparse from Wizards</button><button class="btn btn-ghost" data-act="open-url" data-arg="${esc(article.url)}">Inspect official source ↗</button></div>
  </div>`;
}

function articleSearchResults(article, query) {
  const needle = query.trim().toLowerCase();
  const results = [];
  const push = (type, title, text) => { if (`${title} ${text}`.toLowerCase().includes(needle)) results.push({ type, title, text }); };
  push('Summary', article.title, article.summary || '');
  for (const section of article.sections || []) push('Section', section.heading, section.paragraphs?.join(' ') || section.summary || '');
  for (const card of (article.cards?.length ? article.cards : article.releaseNoteCards || [])) push('Card', card.name || card.sourceName, `${card.typeLine || ''} ${card.oracleText || ''} ${(card.rulings || []).join(' ')}`);
  return results.slice(0, 40);
}

function renderArticleSearch(article, query) {
  const results = articleSearchResults(article, query);
  return `<div class="briefing-article-results"><div><strong>${results.length} result${results.length === 1 ? '' : 's'}</strong><span>Searching inside “${esc(article.title)}”</span></div>${results.length ? results.map(result => `<article><em>${esc(result.type)}</em><h3>${esc(result.title)}</h3><p>${esc(result.text.slice(0, 420))}</p></article>`).join('') : '<div class="briefing-empty">Nothing in this article matches that search.</div>'}</div>`;
}

function renderArticle(article) {
  const query = String(ui.briefing.articleSearch || '').trim();
  const view = ui.briefing.view || 'overview';
  const body = query ? renderArticleSearch(article, query) : view === 'cards' ? renderCards(article) : view === 'sections' ? renderSections(article) : view === 'rulings' ? renderRulings(article) : view === 'diagnostics' ? renderDiagnostics(article) : renderOverview(article);
  const updateNotice = articleIsUpdated(article) ? `<div class="briefing-update-notice"><strong>Updated since you last read it</strong>${(article.changeSummary || []).map(change => `<span>${esc(change)}</span>`).join('')}</div>` : '';
  return `<article class="briefing-reader"><header class="briefing-article-head"><div class="briefing-kind-row"><span class="briefing-kind kind-${esc(article.kind)}">${esc(kindLabel(article.kind))}</span>${article.setCode ? `<span>${esc(article.setCode)}</span>` : ''}${articleIsNew(article) ? '<span class="briefing-new-pill">New</span>' : ''}</div><h2>${esc(article.title)}</h2><div class="briefing-meta"><span>Published ${esc(readableDate(article.publishedAt))}</span>${article.modifiedAt ? `<span>Updated ${esc(readableDate(article.modifiedAt))}</span>` : ''}${article.author ? `<span>By ${esc(article.author)}</span>` : ''}<span>Official Wizards source</span></div><div class="briefing-actions"><button type="button" class="btn btn-primary" data-act="open-url" data-arg="${esc(article.url)}">Open on Wizards.com ↗</button><button type="button" class="btn ${articleIsSaved(article) ? 'btn-primary' : 'btn-ghost'}" data-act="toggleBriefingBookmark" data-arg="${esc(article.url)}">${articleIsSaved(article) ? '★ Saved' : '☆ Save article'}</button>${(article.pdfLinks || []).slice(0, 2).map(link => `<button type="button" class="btn btn-ghost" data-act="open-url" data-arg="${esc(link.url)}">${esc(link.label || 'Official PDF')} ↓</button>`).join('')}</div>${updateNotice}</header>${renderArticleTabs(article)}<div class="briefing-article-body">${body}</div></article>`;
}

const option = (value, current, label = value) => `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`;

export function renderBriefing() {
  beginBriefingSession();
  const allRows = wizardsArticles().map(applyBriefingCorrections);
  const b = ui.briefing;
  const filters = { filter: b.filter, status: b.status, search: b.search, author: b.author, setCode: b.setCode, dateFrom: b.dateFrom, dateTo: b.dateTo, hasCards: b.hasCards };
  const rows = sortBriefingArticles(allRows.filter(article => briefingArticleMatchesFilters(article, filters)), b.sort);
  let selected = rows.find(article => article.url === b.articleUrl) || rows[0] || null;
  if (selected && b.articleUrl !== selected.url) b.articleUrl = selected.url;
  const info = wizardsArticleInfo();
  const authors = [...new Set(allRows.map(article => article.author).filter(Boolean))].sort();
  const setCodes = [...new Set(allRows.map(article => article.setCode).filter(Boolean))].sort();
  const unread = allRows.filter(article => !articleIsRead(article)).length;
  const filterButtons = FILTERS.map(([value, label]) => `<button type="button" class="btn ${b.filter === value ? 'btn-primary' : 'btn-ghost'} briefing-filter" data-act="ui-set" data-path="briefing.filter" data-val="${value}" data-also="briefing.articleUrl=;briefing.view=overview;briefing.feedScroll=0">${label}</button>`).join('');
  return `<section class="briefing-page"><header class="briefing-page-head"><div><span class="briefing-eyebrow">Official Magic intelligence</span><h1>Briefing</h1><p>Announcements, release notes, rules updates, and product news in one place.</p></div><div class="briefing-sync"><span>${info?.fetchedAt ? `Last checked ${esc(readableDate(info.fetchedAt))}` : 'Not synced yet'}</span><div><button type="button" class="btn btn-ghost" data-act="jumpToNewestBriefingArticle" ${allRows.length ? '' : 'disabled'}>↑ Jump to newest</button><button type="button" class="btn btn-ghost" data-act="markAllBriefingArticlesRead" ${unread ? '' : 'disabled'}>✓ Mark all read${unread ? ` · ${unread}` : ''}</button><button type="button" class="btn btn-ghost" data-act="showBriefingImportModal" ${b.syncing || b.importing ? 'disabled' : ''}>${b.importing ? '⏳ Importing…' : '+ Import article'}</button><button type="button" class="btn btn-ghost" data-act="syncBriefing" ${b.syncing || b.importing ? 'disabled' : ''}>${b.syncing ? '⏳ Syncing…' : '↻ Sync Wizards'}</button></div></div></header>
    <div class="briefing-filters"><div class="briefing-filter-buttons">${filterButtons}</div><div class="briefing-search"><span aria-hidden="true">⌕</span><input id="briefingSearch" type="search" placeholder="Search ${allRows.length} articles…" value="${esc(b.search || '')}" data-act="ui-set" data-path="briefing.search" data-also="briefing.articleUrl=;briefing.view=overview;briefing.feedScroll=0" data-refocus="briefingSearch" aria-label="Search Briefing articles">${b.search ? '<button type="button" data-act="ui-set" data-path="briefing.search" data-val="" data-also="briefing.articleUrl=;briefing.view=overview;briefing.feedScroll=0" aria-label="Clear article search">×</button>' : ''}</div></div>
    <div class="briefing-discovery"><select data-act="ui-set" data-path="briefing.status" data-also="briefing.articleUrl=;briefing.feedScroll=0">${option('all', b.status, 'Any status')}${option('unread', b.status, `Unread · ${unread}`)}${option('new', b.status, 'New this session')}${option('updated', b.status, 'Updated')}${option('saved', b.status, 'Saved')}</select><select data-act="ui-set" data-path="briefing.author" data-also="briefing.articleUrl=;briefing.feedScroll=0">${option('all', b.author, 'Any author')}${authors.map(author => option(author, b.author)).join('')}</select><select data-act="ui-set" data-path="briefing.setCode" data-also="briefing.articleUrl=;briefing.feedScroll=0">${option('all', b.setCode, 'Any set')}${setCodes.map(set => option(set, b.setCode)).join('')}</select><select data-act="ui-set" data-path="briefing.hasCards" data-also="briefing.articleUrl=;briefing.feedScroll=0">${option('all', b.hasCards, 'Cards or no cards')}${option('yes', b.hasCards, 'Has parsed cards')}${option('no', b.hasCards, 'No parsed cards')}</select><label>From <input type="date" value="${esc(b.dateFrom || '')}" data-act="ui-set" data-path="briefing.dateFrom" data-also="briefing.articleUrl=;briefing.feedScroll=0"></label><label>To <input type="date" value="${esc(b.dateTo || '')}" data-act="ui-set" data-path="briefing.dateTo" data-also="briefing.articleUrl=;briefing.feedScroll=0"></label><select data-act="ui-set" data-path="briefing.sort">${option('newest', b.sort, 'Newest first')}${option('oldest', b.sort, 'Oldest first')}${option('updated', b.sort, 'Recently updated')}${option('matches', b.sort, 'Best card matches')}</select><button class="btn btn-ghost" data-act="resetBriefingFilters">Reset</button></div>
    <div class="briefing-result-count">Showing ${rows.length} of ${allRows.length} articles</div>
    ${allRows.length ? `<div class="briefing-workspace"><aside class="briefing-feed" aria-label="Wizards article feed">${rows.length ? renderFeed(rows, selected) : '<div class="briefing-empty">No articles match these filters.</div>'}</aside>${selected ? renderArticle(selected) : '<div class="briefing-empty">Adjust the filters to select an article.</div>'}</div>` : '<div class="briefing-empty briefing-empty-large">No Wizards articles are cached yet.<br>Use “Sync Wizards” to build the Briefing feed.</div>'}</section>`;
}
