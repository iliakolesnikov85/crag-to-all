import { describe, expect, it } from 'vitest';
import {
  buildSectorEditPatch,
  sectorEditDraft,
  type SectorEditDraft,
  type SectorEditSource,
} from './sectorDetails';

function edited(source: SectorEditSource, patch: Partial<SectorEditDraft> = {}) {
  return { ...sectorEditDraft(source), ...patch };
}

describe('sector details', () => {
  const stored: SectorEditSource = {
    name: 'Wall',
    altitude: '2000m',
    approachTime: '30min',
    season: 'Apr; Jun; Aug - Oct',
    orientation: 'N, NW,',
    timeInSun: '08:00 - 11:00',
  };

  it('reads stored sector details into the editor', () => {
    expect(sectorEditDraft(stored)).toEqual({
      name: 'Wall',
      altitude: '2000',
      approachMinutes: '30',
      months: [3, 5, 7, 8, 9],
      orientations: ['N', 'NW'],
      sunStart: '08:00',
      sunEnd: '11:00',
    });
    expect(sectorEditDraft({ name: 'Wall', timeInSun: '02:30 -' })).toMatchObject({
      sunStart: '02:30',
      sunEnd: '',
    });
    expect(sectorEditDraft({ name: 'Wall', season: 'Dec - Feb' }).months).toEqual([0, 1, 11]);
    expect(sectorEditDraft({ name: 'Wall', orientation: 'NE' }).orientations).toEqual(['NE']);
  });

  it('leaves stored text unchanged when the editor is saved as opened', () => {
    expect(buildSectorEditPatch(stored, sectorEditDraft(stored), [])).toEqual({
      ok: true,
      patch: {},
    });
    expect(buildSectorEditPatch(
      { name: 'Wall', orientation: 'NE', season: 'summer', altitude: '2000 m', timeInSun: '02:30 -' },
      sectorEditDraft({
        name: 'Wall',
        orientation: 'NE',
        season: 'summer',
        altitude: '2000 m',
        timeInSun: '02:30 -',
      }),
      [],
    )).toEqual({ ok: true, patch: {} });
  });

  it('writes season, orientation, and sun time in the stored format', () => {
    expect(buildSectorEditPatch(
      { name: 'Wall' },
      edited({ name: 'Wall' }, { months: [3, 5, 7, 8, 9], orientations: ['NW', 'N'], sunStart: '02:30' }),
      [],
    )).toEqual({
      ok: true,
      patch: {
        season: 'Apr; Jun; Aug - Oct',
        orientation: 'N, NW,',
        timeInSun: '02:30 -',
      },
    });
    expect(buildSectorEditPatch(
      { name: 'Wall' },
      edited({ name: 'Wall' }, {
        months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        sunStart: '08:00',
        sunEnd: '11:00',
      }),
      [],
    )).toEqual({
      ok: true,
      patch: { season: 'Jan - Dec', timeInSun: '08:00 - 11:00' },
    });
    expect(buildSectorEditPatch(
      { name: 'Wall' },
      edited({ name: 'Wall' }, { months: [11, 0, 1] }),
      [],
    )).toEqual({ ok: true, patch: { season: 'Dec - Feb' } });
  });

  it('stores altitude in meters and approach time in minutes', () => {
    expect(buildSectorEditPatch(
      { name: 'Wall', altitude: '1800m', approachTime: '20min' },
      edited({ name: 'Wall', altitude: '1800m', approachTime: '20min' }, {
        altitude: '2100',
        approachMinutes: '45',
      }),
      [],
    )).toEqual({
      ok: true,
      patch: { altitude: '2100m', approachTime: '45min' },
    });
  });

  it('clears a detail when the editor value is removed', () => {
    expect(buildSectorEditPatch(
      stored,
      edited(stored, { altitude: '', months: [], orientations: [], sunStart: '', sunEnd: '' }),
      [],
    )).toEqual({
      ok: true,
      patch: {
        altitude: null,
        season: null,
        orientation: null,
        timeInSun: null,
      },
    });
  });

  it('renames with the shared sector name rules', () => {
    expect(buildSectorEditPatch(
      { name: 'Wall' },
      edited({ name: 'Wall' }, { name: '  North Wall  ' }),
      ['Cave'],
    )).toEqual({ ok: true, patch: { name: 'North Wall' } });
    expect(buildSectorEditPatch(
      { name: 'Wall' },
      edited({ name: 'Wall' }, { name: '   ' }),
      [],
    )).toEqual({ ok: false, errors: { name: 'Enter a sector name.' } });
    expect(buildSectorEditPatch(
      { name: 'Wall' },
      edited({ name: 'Wall' }, { name: 'cave' }),
      ['Cave'],
    )).toEqual({ ok: false, errors: { name: 'A sector with this name already exists.' } });
  });

  it('requires a start time before an end time', () => {
    expect(buildSectorEditPatch(
      { name: 'Wall' },
      edited({ name: 'Wall' }, { sunEnd: '11:00' }),
      [],
    )).toEqual({ ok: false, errors: { timeInSun: 'Enter the start of the time in sun.' } });
    expect(buildSectorEditPatch(
      { name: 'Wall' },
      edited({ name: 'Wall' }, { sunStart: '25:00' }),
      [],
    )).toEqual({ ok: false, errors: { timeInSun: 'Enter times as HH:MM.' } });
  });
});
