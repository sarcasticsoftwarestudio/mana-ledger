import { describe, expect, it } from 'vitest';
import { organizePrecons } from '../src/renderer-js/preconTab.js';

const decks = [
  { file: 'a', name: 'Arcane Maelstrom', type: 'Commander Deck', code: 'C20', date: '2020-04-17' },
  { file: 'b', name: 'Buckle Up', type: 'Commander Deck', code: 'CMM', date: '2023-08-04' },
  { file: 'c', name: 'Chaos Incarnate', type: 'Commander Deck', code: 'C21', date: '2021-04-23' },
  { file: 'd', name: 'Dragon Duel', type: 'Duel Deck', code: 'C20', date: '2020-04-17', commander: 'Zirda' },
  { file: 'e', name: 'Eldritch Box', type: 'Box Set', code: 'XYZ', date: null },
];
const names = { C20: 'Commander 2020', C21: 'Commander 2021', CMM: 'Commander Masters' };
const env = { setName: c => names[c] || c, completion: d => ({ a: 0.5, b: 1, c: 0 }[d.file] || 0) };
const flat = (groups) => groups.flatMap(g => g.decks.map(d => d.file));

describe('organizePrecons', () => {
  it('sorts newest to oldest by default, undated last', () => {
    expect(flat(organizePrecons(decks, {}, env))).toEqual(['b', 'c', 'a', 'd', 'e']);
  });

  it('sorts oldest to newest, still keeping undated decks last', () => {
    expect(flat(organizePrecons(decks, { sort: 'date_asc' }, env))).toEqual(['a', 'd', 'c', 'b', 'e']);
  });

  it('sorts by set name, then newest first within a set', () => {
    expect(flat(organizePrecons(decks, { sort: 'set_asc' }, env))).toEqual(['a', 'd', 'c', 'b', 'e']);
  });

  it('sorts by name both ways and by completion', () => {
    expect(flat(organizePrecons(decks, { sort: 'name_desc' }, env))).toEqual(['e', 'd', 'c', 'b', 'a']);
    expect(flat(organizePrecons(decks, { sort: 'own_desc' }, env))[0]).toBe('b');
  });

  it('groups by set with names, ordered by set release newest first', () => {
    const groups = organizePrecons(decks, { group: 'set' }, env);
    expect(groups.map(g => g.label)).toEqual(['Commander Masters', 'Commander 2021', 'Commander 2020', 'XYZ']);
    expect(groups[2].decks.map(d => d.file)).toEqual(['a', 'd']);
  });

  it('groups by year and by product line', () => {
    expect(organizePrecons(decks, { group: 'year' }, env).map(g => g.key)).toEqual(['2023', '2021', '2020', 'Undated']);
    expect(organizePrecons(decks, { group: 'line' }, env).map(g => g.label)).toEqual(['Commander Decks', 'Duel Decks', 'Box Sets']);
  });

  it('filters by set code and searches set names, commanders, and lines', () => {
    expect(flat(organizePrecons(decks, { setFilter: 'c20' }, env))).toEqual(['a', 'd']);
    expect(flat(organizePrecons(decks, { search: 'masters' }, env))).toEqual(['b']);
    expect(flat(organizePrecons(decks, { search: 'zirda' }, env))).toEqual(['d']);
    expect(flat(organizePrecons(decks, { search: 'duel deck' }, env))).toEqual(['d']);
  });
});
