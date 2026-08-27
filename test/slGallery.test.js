import { describe, expect, it } from 'vitest';
import { slGalleryCatalog } from '../src/renderer-js/slTab.js';

describe('Secret Lair Gallery source reconciliation', () => {
  it('merges every live exact upcoming card without duplicating baked gallery entries', () => {
    const baked = slGalleryCatalog([]);
    const existing = baked.find(card => card.setCode === 'slz');
    const liveOnly = {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Path to Exile',
      collectorNumber: '7',
      releasedAt: '2099-09-02',
      setCode: 'slz',
    };
    const liveGroups = [{
      setCode: 'slz', setName: 'The Zeta Set', releaseDate: '2099-09-02',
      cards: [
        liveOnly,
        {
          id: existing.id, name: existing.name, collectorNumber: existing.num,
          releasedAt: '2099-09-02', setCode: 'slz',
        },
      ],
    }];

    const merged = slGalleryCatalog(liveGroups);

    expect(merged).toHaveLength(baked.length + 1);
    expect(merged.filter(card => card.id === existing.id)).toHaveLength(1);
    expect(merged.find(card => card.id === liveOnly.id)).toMatchObject({
      name: 'Path to Exile', num: '7', setCode: 'slz', setName: 'The Zeta Set', preview: true,
    });
    expect(liveGroups[0].cards.every(card => merged.some(row => row.id === card.id))).toBe(true);
  });

  it('automatically admits exact cards from future standalone Secret Lair set codes', () => {
    const id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const merged = slGalleryCatalog([{
      setCode: 'slq', setName: 'Future Secret Lair Set', releaseDate: '2099-10-01',
      cards: [{ id, name: 'Future Card', collectorNumber: '1', setCode: 'slq' }],
    }]);

    expect(merged.find(card => card.id === id)).toMatchObject({
      name: 'Future Card', num: '1', setCode: 'slq', setName: 'Future Secret Lair Set', preview: true,
    });
  });
});
