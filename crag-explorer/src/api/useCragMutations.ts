import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { CragData, DescriptionSection, LatLng, Sector } from '../types';
import {
  createSector,
  deleteSector,
  patchCragDescription,
  patchSectorGeo,
  type CreateSectorInput,
} from './client';
import { queryKeys } from './queryClient';

// A crag refetch that started before this write can resolve later and replace the
// cache with the older document. Cancel that fetch before applying the response.
// Cancellation reverts it to the pre-fetch snapshot; the write then runs on top.
function cancelInFlightCragFetch(queryClient: QueryClient, cragId: string): Promise<void> {
  return queryClient.cancelQueries({ queryKey: queryKeys.crag(cragId), exact: true });
}

function writeCragData(
  queryClient: QueryClient,
  cragId: string,
  write: (current: CragData) => CragData,
): void {
  void cancelInFlightCragFetch(queryClient, cragId);
  queryClient.setQueryData<CragData>(queryKeys.crag(cragId), (current) =>
    current ? write(current) : current,
  );
}

function replaceCragDescription(
  queryClient: QueryClient,
  cragId: string,
  description: DescriptionSection[],
  version: number,
): void {
  writeCragData(queryClient, cragId, (current) => ({ ...current, description, version }));
}

function replaceSector(queryClient: QueryClient, cragId: string, sector: Sector): void {
  writeCragData(queryClient, cragId, (current) => {
    if (sector.id == null) return current;
    return {
      ...current,
      sectors: current.sectors.map((item) => (item.id === sector.id ? sector : item)),
    };
  });
}

function appendSector(queryClient: QueryClient, cragId: string, sector: Sector): void {
  writeCragData(queryClient, cragId, (current) => ({
    ...current,
    sectors: [...current.sectors, sector],
  }));
}

function removeSector(queryClient: QueryClient, cragId: string, sectorId: string): void {
  writeCragData(queryClient, cragId, (current) => ({
    ...current,
    sectors: current.sectors.filter((sector) => sector.id !== sectorId),
  }));
}

export function usePatchCragDescription(cragId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { version: number; description: DescriptionSection[] }) =>
      patchCragDescription(cragId, input.version, input.description),
    onMutate: () => cancelInFlightCragFetch(queryClient, cragId),
    onSuccess: (saved) => {
      replaceCragDescription(queryClient, cragId, saved.description, saved.version);
    },
  });
}

export function usePatchSectorGeo(cragId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sectorId: string;
      version: number;
      patch: { name?: string; geo?: LatLng };
    }) => patchSectorGeo(cragId, input.sectorId, input.version, input.patch),
    onMutate: () => cancelInFlightCragFetch(queryClient, cragId),
    onSuccess: (sector) => {
      replaceSector(queryClient, cragId, sector);
    },
  });
}

export function useCreateSector(cragId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sector: CreateSectorInput) => createSector(cragId, sector),
    onMutate: () => cancelInFlightCragFetch(queryClient, cragId),
    onSuccess: (sector) => {
      appendSector(queryClient, cragId, sector);
    },
  });
}

export function useDeleteSector(cragId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sectorId: string) => deleteSector(cragId, sectorId),
    onMutate: () => cancelInFlightCragFetch(queryClient, cragId),
    onSuccess: (_result, sectorId) => {
      removeSector(queryClient, cragId, sectorId);
    },
  });
}
