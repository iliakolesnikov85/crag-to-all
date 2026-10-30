import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import type { CragData, DescriptionSection, Sector } from '../types';
import { createSector, deleteSector, patchCragDescription, patchSectorGeo } from './client';
import { createAppQueryClient, queryKeys } from './queryClient';
import {
  useCreateSector,
  useDeleteSector,
  usePatchCragDescription,
  usePatchSectorGeo,
} from './useCragMutations';

vi.mock('./client', () => ({
  patchCragDescription: vi.fn(),
  patchSectorGeo: vi.fn(),
  createSector: vi.fn(),
  deleteSector: vi.fn(),
}));

const nextDescription: DescriptionSection[] = [
  { subheader: 'Access', paragraphs: ['New approach'] },
];

const mainSector: Sector = {
  ...sampleCragData.sectors[0],
  id: 'sector-1',
  version: 1,
};

const otherSector: Sector = {
  ...sampleCragData.sectors[1],
  id: 'sector-2',
  version: 1,
};

const loadedCrag: CragData = {
  ...sampleCragData,
  version: 3,
  description: [{ subheader: 'Access', paragraphs: ['Old approach'] }],
  sectors: [mainSector, otherSector],
};

function cragDocument(version: number, description: DescriptionSection[]): CragData {
  return { ...sampleCragData, version, description };
}

function renderMutation<T>(client: QueryClient, useHook: () => T) {
  return renderHook(useHook, {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children),
  });
}

function renderDescriptionMutation(client: QueryClient) {
  return renderMutation(client, () => usePatchCragDescription(SAMPLE_CRAG_ID));
}

function startStaleCragFetch(client: QueryClient, stale: CragData): () => void {
  let finish = (): void => {};
  const pending = new Promise<CragData>((resolve) => {
    finish = () => resolve(stale);
  });
  const request = client.fetchQuery({
    queryKey: queryKeys.crag(SAMPLE_CRAG_ID),
    queryFn: () => pending,
  });
  void request.catch((error: unknown) => {
    console.warn('In-flight crag fetch ended:', error);
  });
  return finish;
}

async function settleStaleFetch(finish: () => void): Promise<void> {
  await act(async () => {
    finish();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

function expectSavedDescription(client: QueryClient): void {
  expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))).toMatchObject({
    version: 4,
    description: nextDescription,
  });
}

describe('usePatchCragDescription', () => {
  beforeEach(() => {
    vi.mocked(patchCragDescription).mockReset();
  });

  it('keeps the save when an earlier crag fetch resolves afterwards', async () => {
    const stale = cragDocument(3, [{ subheader: 'Access', paragraphs: ['Old approach'] }]);
    vi.mocked(patchCragDescription).mockResolvedValue({
      description: nextDescription,
      version: 4,
    });
    const client = createAppQueryClient();
    client.setQueryData(queryKeys.crag(SAMPLE_CRAG_ID), stale);
    const finishStaleFetch = startStaleCragFetch(client, stale);
    expect(client.isFetching({ queryKey: queryKeys.crag(SAMPLE_CRAG_ID) })).toBe(1);

    const { result } = renderDescriptionMutation(client);
    await result.current.mutateAsync({ version: 3, description: nextDescription });
    await settleStaleFetch(finishStaleFetch);

    expectSavedDescription(client);
  });

  it('keeps the save when a crag fetch starts while the save is in flight', async () => {
    const stale = cragDocument(3, [{ subheader: 'Access', paragraphs: ['Old approach'] }]);
    let resolvePatch: (saved: { description: DescriptionSection[]; version: number }) => void = () => {};
    vi.mocked(patchCragDescription).mockImplementation(
      () => new Promise((resolve) => {
        resolvePatch = resolve;
      }),
    );
    const client = createAppQueryClient();
    client.setQueryData(queryKeys.crag(SAMPLE_CRAG_ID), stale);
    const { result } = renderDescriptionMutation(client);

    const saving = result.current.mutateAsync({ version: 3, description: nextDescription });
    await waitFor(() => {
      expect(patchCragDescription).toHaveBeenCalled();
    });
    const finishStaleFetch = startStaleCragFetch(client, stale);
    resolvePatch({ description: nextDescription, version: 4 });
    await saving;
    await settleStaleFetch(finishStaleFetch);

    expectSavedDescription(client);
  });
});

describe('crag cache updates', () => {
  beforeEach(() => {
    vi.mocked(patchCragDescription).mockReset();
    vi.mocked(patchSectorGeo).mockReset();
    vi.mocked(createSector).mockReset();
    vi.mocked(deleteSector).mockReset();
  });

  it('replaces the description and version and keeps the sectors', async () => {
    vi.mocked(patchCragDescription).mockResolvedValue({
      description: nextDescription,
      version: 4,
    });
    const client = createAppQueryClient();
    client.setQueryData(queryKeys.crag(SAMPLE_CRAG_ID), loadedCrag);

    const { result } = renderDescriptionMutation(client);
    await result.current.mutateAsync({ version: 3, description: nextDescription });

    expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))).toEqual({
      ...loadedCrag,
      description: nextDescription,
      version: 4,
    });
  });

  it('replaces the saved sector and leaves the rest of the crag', async () => {
    const moved: Sector = {
      ...mainSector,
      name: 'North Wall',
      version: 2,
      geo: { lat: 1, lon: 2 },
    };
    vi.mocked(patchSectorGeo).mockResolvedValue(moved);
    const client = createAppQueryClient();
    client.setQueryData(queryKeys.crag(SAMPLE_CRAG_ID), loadedCrag);

    const { result } = renderMutation(client, () => usePatchSectorGeo(SAMPLE_CRAG_ID));
    await result.current.mutateAsync({
      sectorId: 'sector-1',
      version: 1,
      patch: { name: 'North Wall', geo: { lat: 1, lon: 2 } },
    });

    expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))).toEqual({
      ...loadedCrag,
      sectors: [moved, otherSector],
    });
  });

  it('appends a created sector', async () => {
    const created: Sector = {
      id: 'north',
      name: 'North Wall',
      version: 1,
      geo: { lat: 1, lon: 2 },
      routes: [],
      images: [],
    };
    vi.mocked(createSector).mockResolvedValue(created);
    const client = createAppQueryClient();
    client.setQueryData(queryKeys.crag(SAMPLE_CRAG_ID), loadedCrag);

    const { result } = renderMutation(client, () => useCreateSector(SAMPLE_CRAG_ID));
    await result.current.mutateAsync({ name: 'North Wall', geo: { lat: 1, lon: 2 } });

    expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))).toEqual({
      ...loadedCrag,
      sectors: [mainSector, otherSector, created],
    });
  });

  it('removes the deleted sector and leaves the others', async () => {
    vi.mocked(deleteSector).mockResolvedValue(undefined);
    const client = createAppQueryClient();
    client.setQueryData(queryKeys.crag(SAMPLE_CRAG_ID), loadedCrag);

    const { result } = renderMutation(client, () => useDeleteSector(SAMPLE_CRAG_ID));
    await result.current.mutateAsync('sector-1');

    expect(client.getQueryData<CragData>(queryKeys.crag(SAMPLE_CRAG_ID))).toEqual({
      ...loadedCrag,
      sectors: [otherSector],
    });
  });

  it('updates the crag that was saved and leaves a different crag cached', async () => {
    vi.mocked(patchCragDescription).mockResolvedValue({
      description: nextDescription,
      version: 4,
    });
    const client = createAppQueryClient();
    const otherCrag = { ...loadedCrag, name: 'Other' };
    client.setQueryData(queryKeys.crag(SAMPLE_CRAG_ID), loadedCrag);
    client.setQueryData(queryKeys.crag('other'), otherCrag);

    const { result } = renderMutation(client, () => usePatchCragDescription('other'));
    await result.current.mutateAsync({ version: 3, description: nextDescription });

    expect(client.getQueryData(queryKeys.crag(SAMPLE_CRAG_ID))).toEqual(loadedCrag);
    expect(client.getQueryData<CragData>(queryKeys.crag('other'))).toEqual({
      ...otherCrag,
      description: nextDescription,
      version: 4,
    });
  });
});
