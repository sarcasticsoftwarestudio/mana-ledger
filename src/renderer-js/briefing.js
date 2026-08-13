import { render } from './render.js';
import { promptText } from './modals.js';
import { ui } from './state.js';
import { esc, toast } from './utils.js';
import { importWizardsArticle, refreshWizardsArticles, wizardsArticleInfo, wizardsArticles } from './wizardsArticles.js';

const KIND_LABELS = {
  release_notes: 'Release notes',
  secret_lair: 'Secret Lair',
  banned_restricted: 'Banned & restricted',
  rules_update: 'Rules update',
  product_guide: 'Product guide',
  announcement: 'Announcement',
  design: 'Design',
  feature: 'Feature',
};

const FILTERS = [
  ['all', 'All'],
  ['release_notes', 'Release notes'],
  ['announcement', 'Announcements'],
  ['secret_lair', 'Secret Lair'],
];

const readableDate = raw => {
  const iso = String(raw || '').slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw || 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])));
};

const kindLabel = kind => KIND_LABELS[kind] || 'Article';

const matchesFilter = (article, filter) => {
  if (!filter || filter === 'all') return true;
  if (filter === 'announcement') return article.kind === 'announcement' || article.category === 'announcements';
  return article.kind === filter;
};

export const articleMatchesSearch = (article, value) => {
  const query = String(value || '').trim().toLowerCase();
  if (!query) return true;
  return [article.title, article.summary, article.author, article.category, kindLabel(article.kind), ...(article.headings || [])]
    .some(field => String(field || '').toLowerCase().includes(query));
};

export async function syncBriefing() {
  if (ui.briefing.syncing || ui.briefing.importing) return;
  ui.briefing.syncing = true;
  render();
  const ok = await refreshWizardsArticles();
  ui.briefing.syncing = false;
  if (!ok) toast('Wizards Briefing sync failed — showing the last good cache.', 'error');
  render();
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
      ui.briefing.view = article.cards?.length || article.embeddedCards?.length ? 'cards' : 'overview';
      toast(`Imported ${article.title}`, 'success');
    } catch (error) {
      toast(error.message || 'That Wizards article could not be imported.', 'error');
    } finally {
      ui.briefing.importing = false;
      render();
    }
  });
}

export function attachBriefingListeners() {
  const feed = document.querySelector('.briefing-feed');
  if (!feed) return;
  feed.scrollTop = Number(ui.briefing.feedScroll) || 0;
  feed.addEventListener('scroll', () => { ui.briefing.feedScroll = feed.scrollTop; }, { passive: true });
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
    grouped.push(`
      <button type="button" class="briefing-feed-item${selected?.url === row.url ? ' active' : ''}"
        data-act="ui-set" data-path="briefing.articleUrl" data-val="${esc(row.url)}" data-also="briefing.view=overview">
        <span class="briefing-feed-kind kind-${esc(row.kind)}">${esc(kindLabel(row.kind))}</span>
        <strong>${esc(row.title)}</strong>
        <small>${esc(readableDate(row.publishedAt))}${row.author ? ` · ${esc(row.author)}` : ''}</small>
      </button>`);
  }
  return grouped.join('');
}

function renderArticleTabs(article) {
  const view = ui.briefing.view || 'overview';
  const button = (id, label) => `<button type="button" class="briefing-tab${view === id ? ' active' : ''}"
    data-act="ui-set" data-path="briefing.view" data-val="${id}">${label}</button>`;
  const cardCount = article.embeddedCards?.length || article.cards?.length || article.releaseNoteCards?.length || 0;
  const rulingCount = (article.cards || []).filter(card => card.rulings?.length).length
    || (article.releaseNoteCards || []).filter(card => card.rulings?.length).length;
  return `<nav class="briefing-tabs" aria-label="Article sections">
    ${button('overview', 'Overview')}
    ${cardCount ? button('cards', `Cards · ${cardCount}`) : ''}
    ${article.sections?.length ? button('sections', `Sections · ${article.sections.length}`) : ''}
    ${rulingCount ? button('rulings', `Card rulings · ${rulingCount}`) : ''}
  </nav>`;
}

function renderOverview(article) {
  const embedded = article.embeddedCards || [];
  const cards = embedded.length ? embedded.filter(card => card.scryfallId).length : (article.cards?.length || 0);
  const expected = embedded.length || article.collectorNumbers?.length || article.releaseNoteCards?.length || 0;
  const matched = expected ? `${cards} / ${expected}` : '—';
  const sourceNotes = [
    article.parserConfidence ? `${article.parserConfidence} parser confidence` : '',
    article.evidence?.title ? `title: ${article.evidence.title}` : '',
    article.evidence?.cards ? `cards: ${article.evidence.cards}` : '',
  ].filter(Boolean);
  return `
    ${article.summary ? `<p class="briefing-summary">${esc(article.summary)}</p>` : ''}
    <div class="briefing-stat-grid">
      <div><span>Article type</span><strong>${esc(kindLabel(article.kind))}</strong></div>
      <div><span>Parsed sections</span><strong>${article.sections?.length || 0}</strong></div>
      <div><span>Card matches</span><strong>${esc(matched)}</strong></div>
      ${article.setCode ? `<div><span>Set</span><strong>${esc(article.setCode)}</strong></div>` : ''}
    </div>
    ${article.headings?.length ? `
      <section class="briefing-outline">
        <h3>Article outline</h3>
        <div>${article.headings.slice(0, 12).map(heading => `<span>${esc(heading)}</span>`).join('')}</div>
      </section>` : ''}
    ${sourceNotes.length ? `<div class="briefing-evidence">${sourceNotes.map(note => `<span>${esc(note)}</span>`).join('')}</div>` : ''}`;
}

function renderCards(article) {
  const cards = article.cards || [];
  const embedded = article.embeddedCards || [];
  if (!cards.length && !embedded.length) {
    const pending = article.releaseNoteCards?.length || 0;
    return `<div class="briefing-empty">${pending ? `${pending} card names were parsed, but exact Scryfall matching is unavailable. Sync sources to retry.` : 'No card list was detected in this article.'}</div>`;
  }
  const matched = embedded.length ? embedded.filter(card => card.scryfallId).length : cards.length;
  const expected = embedded.length || article.collectorNumbers?.length || article.releaseNoteCards?.length || cards.length;
  return `
    <div class="briefing-gallery-head">
      <div><strong>Cards in this article</strong><small>${embedded.length ? 'Images come directly from the Wizards article. Hover matched names for Scryfall details; unlabeled source artwork stays visible without a guessed identity.' : 'Hover for the same printing details used throughout Mana Ledger. Select a card for the full view.'}</small></div>
      <span class="briefing-match ${matched === expected ? 'complete' : 'partial'}">${matched} of ${expected} matched</span>
    </div>
    <div class="briefing-card-grid">
      ${embedded.length ? embedded.map(card => {
        const label = card.name || card.displayName || 'Article card image';
        const detail = card.scryfallId
          ? `data-scryfall-id="${esc(card.scryfallId)}" data-slact="card-modal" data-arg="${esc(card.scryfallId)}" aria-label="Open ${esc(card.matchedName || label)}"`
          : `aria-label="${esc(label)}; source image has no reliable card-name match"`;
        const openTag = card.scryfallId ? 'button type="button"' : 'div';
        return `<${openTag} class="gallery-card briefing-card${card.scryfallId ? '' : ' briefing-card-source'}" ${detail}>
          <img src="${esc(card.imageUrl)}" alt="${esc(label)}" loading="lazy" data-imgerr="hide-card">
          <span><b>${esc(label)}</b>${card.section && card.section !== label ? `<small>${esc(card.section)}</small>` : ''}</span>
          <em>${card.scryfallId ? 'Matched' : 'Source'}</em>
        </${card.scryfallId ? 'button' : 'div'}>`;
      }).join('') : cards.map(card => `<button type="button" class="gallery-card briefing-card" data-scryfall-id="${esc(card.id)}" data-slact="card-modal" data-arg="${esc(card.id)}" aria-label="Open ${esc(card.name)}">
        <img src="${esc(card.imageSmall || card.imageNormal)}" alt="${esc(card.name)}" loading="lazy" data-imgerr="hide-card">
        <span><b>${esc(card.name)}</b></span>
        <em>${card.match?.confidence === 'exact' ? 'Exact' : 'Matched'}</em>
      </button>`).join('')}
    </div>
    ${(article.unmatchedCards || []).length ? `<div class="briefing-unmatched"><strong>Needs review</strong><span>${article.unmatchedCards.map(name => esc(name)).join(' · ')}</span></div>` : ''}`;
}

function renderSections(article) {
  const sections = article.sections || [];
  if (!sections.length) return '<div class="briefing-empty">No structured sections were detected. The official article is still available from the source link.</div>';
  return `<div class="briefing-sections">${sections.map((section, index) => `
    <details${index < 2 ? ' open' : ''}>
      <summary>${esc(section.heading)}</summary>
      ${section.paragraphs?.length ? section.paragraphs.slice(0, 5).map(paragraph => `<p>${esc(paragraph)}</p>`).join('') : `<p>${esc(section.summary)}</p>`}
    </details>`).join('')}</div>`;
}

function renderRulings(article) {
  const cards = (article.cards?.length ? article.cards : article.releaseNoteCards || []).filter(card => card.rulings?.length);
  if (!cards.length) return '<div class="briefing-empty">No card-specific rulings were detected.</div>';
  return `<div class="briefing-rulings">${cards.map(card => `
    <details>
      <summary>
        ${card.imageSmall ? `<img src="${esc(card.imageSmall)}" alt="" loading="lazy" data-imgerr="hide">` : ''}
        <span><strong>${esc(card.name || card.sourceName)}</strong><small>${card.setCode ? `${esc(card.setCode)} · #${esc(card.collectorNumber || '?')}` : esc(card.noteSection || '')}</small></span>
        <em>${card.rulings.length} note${card.rulings.length === 1 ? '' : 's'}</em>
      </summary>
      <ul>${card.rulings.map(ruling => `<li>${esc(ruling)}</li>`).join('')}</ul>
    </details>`).join('')}</div>`;
}

function renderArticle(article) {
  const view = ui.briefing.view || 'overview';
  const body = view === 'cards' ? renderCards(article)
    : view === 'sections' ? renderSections(article)
      : view === 'rulings' ? renderRulings(article)
        : renderOverview(article);
  return `<article class="briefing-reader">
    <header class="briefing-article-head">
      <div class="briefing-kind-row"><span class="briefing-kind kind-${esc(article.kind)}">${esc(kindLabel(article.kind))}</span>${article.setCode ? `<span>${esc(article.setCode)}</span>` : ''}</div>
      <h2>${esc(article.title)}</h2>
      <div class="briefing-meta">
        <span>Published ${esc(readableDate(article.publishedAt))}</span>
        ${article.modifiedAt ? `<span>Updated ${esc(readableDate(article.modifiedAt))}</span>` : ''}
        ${article.author ? `<span>By ${esc(article.author)}</span>` : ''}
        <span>Official Wizards source</span>
      </div>
      <div class="briefing-actions">
        <button type="button" class="btn btn-primary" data-act="open-url" data-arg="${esc(article.url)}">Open on Wizards.com ↗</button>
        ${(article.pdfLinks || []).slice(0, 2).map(link => `<button type="button" class="btn btn-ghost" data-act="open-url" data-arg="${esc(link.url)}">${esc(link.label || 'Official PDF')} ↓</button>`).join('')}
      </div>
    </header>
    ${renderArticleTabs(article)}
    <div class="briefing-article-body">${body}</div>
  </article>`;
}

export function renderBriefing() {
  const allRows = wizardsArticles().slice().sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  const filter = ui.briefing.filter || 'all';
  const search = ui.briefing.search || '';
  const rows = allRows.filter(article => matchesFilter(article, filter) && articleMatchesSearch(article, search));
  let selected = rows.find(article => article.url === ui.briefing.articleUrl) || rows[0] || null;
  if (selected && ui.briefing.articleUrl !== selected.url) ui.briefing.articleUrl = selected.url;
  const info = wizardsArticleInfo();
  const filterButtons = FILTERS.map(([value, label]) => `<button type="button" class="btn ${filter === value ? 'btn-primary' : 'btn-ghost'} briefing-filter"
    data-act="ui-set" data-path="briefing.filter" data-val="${value}" data-also="briefing.articleUrl=;briefing.view=overview;briefing.feedScroll=0">${label}</button>`).join('');

  return `<section class="briefing-page">
    <header class="briefing-page-head">
      <div><span class="briefing-eyebrow">Official Magic intelligence</span><h1>Briefing</h1><p>Announcements, release notes, rules updates, and product news in one place.</p></div>
      <div class="briefing-sync"><span>${info?.fetchedAt ? `Last checked ${esc(readableDate(info.fetchedAt))}` : 'Not synced yet'}</span><div><button type="button" class="btn btn-ghost" data-act="showBriefingImportModal" ${ui.briefing.syncing || ui.briefing.importing ? 'disabled' : ''}>${ui.briefing.importing ? '⏳ Importing…' : '+ Import article'}</button><button type="button" class="btn btn-ghost" data-act="syncBriefing" ${ui.briefing.syncing || ui.briefing.importing ? 'disabled' : ''}>${ui.briefing.syncing ? '⏳ Syncing…' : '↻ Sync Wizards'}</button></div></div>
    </header>
    <div class="briefing-filters"><div class="briefing-filter-buttons">${filterButtons}</div><div class="briefing-search"><span aria-hidden="true">⌕</span><input id="briefingSearch" type="search" placeholder="Search ${allRows.length} articles…" value="${esc(search)}" data-act="ui-set" data-path="briefing.search" data-also="briefing.articleUrl=;briefing.view=overview;briefing.feedScroll=0" data-refocus="briefingSearch" aria-label="Search Briefing articles">${search ? '<button type="button" data-act="ui-set" data-path="briefing.search" data-val="" data-also="briefing.articleUrl=;briefing.view=overview;briefing.feedScroll=0" aria-label="Clear article search">×</button>' : ''}</div></div>
    ${allRows.length ? `<div class="briefing-workspace">
      <aside class="briefing-feed" aria-label="Wizards article feed">${rows.length ? renderFeed(rows, selected) : '<div class="briefing-empty">No articles match this filter.</div>'}</aside>
      ${selected ? renderArticle(selected) : '<div class="briefing-empty">Select an article.</div>'}
    </div>` : `<div class="briefing-empty briefing-empty-large">No Wizards articles are cached yet.<br>Use “Sync Wizards” to build the Briefing feed.</div>`}
  </section>`;
}
