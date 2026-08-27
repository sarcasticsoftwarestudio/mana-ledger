// Render and interaction smoke test for the searchable end-user Help Center.
'use strict';
const fs = require('fs');
const path = require('path');
const noop = () => {};
let markup = '';
let appClick = null;
let searchInput = null;

const classList = { toggle: noop, remove: noop, add: noop };
const modal = { classList };
const content = {};
Object.defineProperty(content, 'innerHTML', { set: value => { markup = value; }, get: () => markup });
const overlay = { classList, querySelector: () => modal };
const nav = { innerHTML: '', querySelectorAll: () => [] };
const stage = { innerHTML: '', scrollTop: 0, focus: noop };
const input = {
  value: '', focus: noop,
  addEventListener(type, handler) { if (type === 'input') searchInput = handler; },
};
const app = {
  addEventListener(type, handler) { if (type === 'click') appClick = handler; },
};

globalThis.window = { addEventListener: noop, removeEventListener: noop, api: {}, app: {} };
globalThis.document = {
  addEventListener: noop, removeEventListener: noop,
  getElementById(id) {
    return id === 'modal-content' ? content : id === 'modal-overlay' ? overlay
      : id === 'help-nav' ? nav : id === 'help-stage' ? stage : id === 'help-search' ? input : null;
  },
  querySelector(selector) { return selector === '.help-app' ? app : selector === '#modal-overlay .modal' ? modal : null; },
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList, appendChild: noop, remove: noop, addEventListener: noop }),
  body: { dataset: {}, appendChild: noop },
};
globalThis.requestAnimationFrame = callback => callback();

(async () => {
  const { HELP_GUIDES, showHelpCenter } = await import('../src/renderer-js/helpCenter.js');
  showHelpCenter();

  const styles = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'styles.css'), 'utf8');
  const initialChecks = {
    completeCatalog: HELP_GUIDES.length === 25,
    searchableHeader: markup.includes('id="help-search"') && markup.includes('Search guides'),
    groupedNavigation: (markup.match(/class="help-nav-group"/g) || []).length === 5,
    chartGuideLinked: markup.includes('data-help-guide="charts"'),
    settingsSized: /showModal\([\s\S]*'settings'\);/.test((await fs.promises.readFile(path.join(__dirname, '..', 'src', 'renderer-js', 'helpCenter.js'), 'utf8'))),
    constrainedLayout: /\.help-app\s*\{[^}]*height:\s*100%/s.test(styles),
    scrollableArticle: /\.help-stage\s*\{[^}]*overflow-y:\s*auto/s.test(styles),
    responsiveNavigation: /@media \(max-width:760px\)[\s\S]*\.help-layout\s*\{[^}]*grid-template-columns:\s*92px/s.test(styles),
  };
  if (!Object.values(initialChecks).every(Boolean)) throw new Error(`Initial Help Center checks failed: ${JSON.stringify(initialChecks)}`);

  input.value = 'backup restore';
  searchInput();
  const searchWorks = stage.innerHTML.includes('Search results') && stage.innerHTML.includes('Backups, recovery, and cleanup');

  appClick({ target: { closest: () => ({ dataset: { helpGuide: 'charts' } }) } });
  const guideNavigationWorks = input.value === '' && stage.innerHTML.includes('Creating Dashboard charts') && stage.innerHTML.includes('Create a chart in six steps');

  console.log({ ...initialChecks, searchWorks, guideNavigationWorks });
  if (!searchWorks || !guideNavigationWorks) process.exit(1);
  console.log('Help Center render and interaction smoke tests passed.');
})().catch(error => { console.error(error); process.exit(1); });
