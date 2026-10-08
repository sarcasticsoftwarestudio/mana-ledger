// smoke-slwiki.js — exercises the wiki Drop Series parser (slWiki.js) against
// the real wikitext fixture (scripts/sl-build/cache/mtgwiki-dropseries.wikitext,
// gitignored; run scripts/sl-build/fetch-sources.js if missing).
// Run: node scripts/smoke-slwiki.js
'use strict';
const fs = require('fs');
const path = require('path');

const noop = () => {};
globalThis.window = { addEventListener: noop };
globalThis.document = {
  addEventListener: noop, getElementById: () => null, querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop }, appendChild: noop, remove: noop, addEventListener: noop }),
  body: { dataset: {} },
};

let pass = 0, fail = 0;
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.error(`  ✗ ${label}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
};

(async () => {
  const { parseDropSeriesWikitext, rejectWikiParse } = await import('../src/renderer-js/slWiki.js');

  const fixture = path.join(__dirname, 'sl-build', 'cache', 'mtgwiki-dropseries.wikitext');
  if (!fs.existsSync(fixture)) {
    console.error('Fixture missing — run node scripts/sl-build/fetch-sources.js');
    process.exit(1);
  }
  const rows = parseDropSeriesWikitext(fs.readFileSync(fixture, 'utf8'));
  const by = name => rows.filter(r => r.drop.toLowerCase() === name.toLowerCase());

  console.log('— shape —');
  ok(rows.length >= 350, `rows parsed (${rows.length})`);
  const withSd = rows.filter(r => r.superdrop).length;
  ok(withSd > rows.length * 0.5, `superdrop grouping present on most rows (${withSd})`);
  const withPrice = rows.filter(r => r.msrpNonfoil != null || r.msrpFoil != null).length;
  ok(withPrice > rows.length * 0.7, `MSRPs parsed for most rows (${withPrice})`);
  const withDate = rows.filter(r => r.date).length;
  ok(withDate > rows.length * 0.9, `dates parsed (${withDate})`);

  console.log('\n— known rows —');
  const wf = by("Witch's Familiar")[0];
  ok(!!wf, "Witch's Familiar present");
  if (wf) {
    ok(/cats are the best/i.test(wf.superdrop || ''), `grouped under Cats Are the Best Superdrop (${wf.superdrop})`);
    ok(wf.msrpNonfoil === 29.99 && wf.msrpFoil === 39.99, `standard MSRP pair (${wf.msrpNonfoil}/${wf.msrpFoil})`);
    ok(wf.date === '2026-06-15', `release date (${wf.date})`);
  }
  const eld = by('Eldraine Wonderland')[0];
  ok(!!eld, 'Eldraine Wonderland present (2019 foil-only)');
  if (eld) ok(eld.msrpNonfoil == null && eld.msrpFoil === 29.99, `foil-only pricing: no non-foil, $29.99 foil (${eld.msrpNonfoil}/${eld.msrpFoil})`);
  const inked = by('Inked')[0];
  if (inked) ok(inked.msrpNonfoil === 51.99 && inked.msrpFoil === 71.99, `Two Scoops premium MSRPs (${inked.msrpNonfoil}/${inked.msrpFoil})`);

  console.log('\n— standalone drops (no superdrop) —');
  for (const name of ["Marvel's Deadpool", 'The Walking Dead']) {
    const r = by(name)[0];
    ok(!!r && r.superdrop == null, `${name} present as standalone`, r);
  }
  const seb = by('Artist Series: Seb McKinnon')[0];
  ok(!!seb && seb.superdrop === 'Secretversary', `Seb McKinnon grouped under Secretversary (${seb && seb.superdrop})`);
  ok(rows.length >= rows.dropCells * 0.95, `coverage: ${rows.length} of ${rows.dropCells} drop rows parsed`);

  console.log('\n— template forms (old {{SLD|…}} and Oct 2026 {{series|…}}) —');
  const table = cells => `===Drop list===\n{|\n${cells.map(c => `|-\n|1\n|''[[${c}]]''\n|1 - 4\n|2025-01-01\n|$29.99\n|$39.99`).join('\n')}\n|}\n====Artist Series====`;
  for (const [label, cells] of [
    ['old', ['{{SLD|Some Superdrop|Grouped Drop}}', '{{SLD|Lone Drop}}', '{{SLC|Lone Deck}}']],
    ['new', ['{{series|Secret Lair Drop Series: Some Superdrop|Grouped Drop}}', '{{series|Secret Lair Drop Series: Lone Drop}}', '{{series|Secret Lair Commander Deck: Lone Deck}}']],
  ]) {
    const t = parseDropSeriesWikitext(table(cells));
    const got = t.map(r => `${r.superdrop || '-'}/${r.drop}`).join(', ');
    ok(got === 'Some Superdrop/Grouped Drop, -/Lone Drop, -/Lone Deck', `${label} markup → ${got}`);
  }

  console.log('\n— rejecting partial parses —');
  const fake = (n, cells) => Object.defineProperty(Array(n).fill({}), 'dropCells', { value: cells });
  ok(rejectWikiParse(fake(403, 403), 407) === null, 'complete parse accepted');
  ok(rejectWikiParse(fake(403, 403), 345) === null, 'complete parse replaces an earlier partial one');
  ok(!!rejectWikiParse(fake(345, 403), 0), 'Oct 2026 failure (345 of 403 rows) rejected');
  ok(!!rejectWikiParse(fake(300, 300), 407), 'shrink vs last good sync rejected');
  ok(!!rejectWikiParse(fake(50, 50), 0), 'tiny parse rejected');

  console.log('\n— upcoming detection (fixture has post-fixture-date rows) —');
  const future = rows.filter(r => r.date && r.date > '2026-07-01');
  ok(future.length >= 1, `drops dated after 2026-07-01 (${future.length}: ${future.slice(0, 3).map(r => r.drop + ' ' + r.date).join(', ')})`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('SMOKE CRASHED:', e); process.exit(1); });
