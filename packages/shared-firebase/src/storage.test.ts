import { describe, expect, it } from 'vitest';
import { toHistoryStoragePath } from './storage';

const historyDate = new Date(2026, 10, 16);

describe('toHistoryStoragePath', () => {
  it('maps a crag-root file onto that day\'s history zip', () => {
    expect(toHistoryStoragePath('crags/roshka/roshka.json', historyDate)).toBe(
      'crags/roshka/history/2026-11-16/roshka.json.zip',
    );
  });

  it('rejects a nested object under the crag', () => {
    expect(() => toHistoryStoragePath('crags/roshka/topo-images/wall.jpg', historyDate)).toThrow(
      'Expected a crag-root storage path like "crags/{cragId}/{fileName}", got: crags/roshka/topo-images/wall.jpg',
    );
  });

  it('rejects a v1 path that is not under crags/', () => {
    expect(() => toHistoryStoragePath('roshka/roshka.json', historyDate)).toThrow(
      'Expected a crag-root storage path like "crags/{cragId}/{fileName}", got: roshka/roshka.json',
    );
  });

  it('rejects an empty crag id or file name', () => {
    expect(() => toHistoryStoragePath('crags//roshka.json', historyDate)).toThrow(
      /crags\/\{cragId\}\/\{fileName\}/,
    );
    expect(() => toHistoryStoragePath('crags/roshka/', historyDate)).toThrow(
      /crags\/\{cragId\}\/\{fileName\}/,
    );
  });
});
