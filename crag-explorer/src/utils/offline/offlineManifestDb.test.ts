import { describe, expect, it } from 'vitest';
import { SAMPLE_CRAG_ID, sampleCrags } from '../../test/fixtures/cragData';
import {
  deleteOfflineManifest,
  getAllOfflineManifests,
  getOfflineCragIndex,
  getOfflineManifest,
  putOfflineCragIndex,
  putOfflineManifest,
  type OfflineCragManifest,
} from './offlineManifestDb';

function manifest(
  overrides: Partial<OfflineCragManifest> & Pick<OfflineCragManifest, 'cragId'>,
): OfflineCragManifest {
  return {
    cragName: overrides.cragId,
    imageFiles: [],
    downloadedAt: 1,
    lastSyncedAt: 2,
    jsonChecksum: 'abc',
    ...overrides,
  };
}

describe('offlineManifestDb', () => {
  it('round-trips put, get, and delete for a crag manifest', async () => {
    const saved = manifest({
      cragId: SAMPLE_CRAG_ID,
      cragName: 'Test Crag',
      imageFiles: ['wall.jpg'],
      jsonChecksum: 'deadbeef',
    });

    await putOfflineManifest(saved);
    expect(await getOfflineManifest(SAMPLE_CRAG_ID)).toEqual(saved);

    await deleteOfflineManifest(SAMPLE_CRAG_ID);
    expect(await getOfflineManifest(SAMPLE_CRAG_ID)).toBeUndefined();
  });

  it('lists every stored manifest', async () => {
    const a = manifest({ cragId: 'alpha' });
    const b = manifest({ cragId: 'beta', jsonChecksum: 'fff' });
    await putOfflineManifest(a);
    await putOfflineManifest(b);

    const all = await getAllOfflineManifests();
    expect(all).toHaveLength(2);
    expect(all).toEqual(expect.arrayContaining([a, b]));
  });

  it('round-trips the crag index in the meta store', async () => {
    expect(await getOfflineCragIndex()).toBeUndefined();

    await putOfflineCragIndex(sampleCrags);
    expect(await getOfflineCragIndex()).toEqual(sampleCrags);

    await putOfflineCragIndex([]);
    expect(await getOfflineCragIndex()).toEqual([]);
  });
});
