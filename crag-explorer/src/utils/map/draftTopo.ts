import type { LatLng } from '../../types';

const EMPTY_DRAFT_TOPO: DraftTopoSnapshot = {
  file: null,
  error: null,
  previewUrl: null,
  gpsPrompt: null,
  pending: false,
};

export interface DraftTopoSnapshot {
  file: File | null;
  error: string | null;
  previewUrl: string | null;
  /** Set when the chosen photo has a location different from the draft pin. */
  gpsPrompt: LatLng | null;
  /** True while a chosen file is still being checked or its location is being read. */
  pending: boolean;
}

export interface DraftTopo {
  subscribe(listener: () => void): () => void;
  getSnapshot(): DraftTopoSnapshot;
  /** Start a file check. A newer call supersedes an older one. */
  beginRead(): number;
  isCurrentRead(id: number): boolean;
  finishRead(id: number): void;
  accept(file: File): void;
  /** Record a validation error for this read, without dropping a photo already accepted. */
  reject(id: number, message: string): void;
  setGpsPrompt(geo: LatLng): void;
  dismissGpsPrompt(): void;
  dispose(): void;
}

export function getEmptyDraftTopoSnapshot(): DraftTopoSnapshot {
  return EMPTY_DRAFT_TOPO;
}

/** Chosen topo for one draft sector. Shared by the popup and the mobile panel. */
export function createDraftTopo(): DraftTopo {
  let disposed = false;
  let readGeneration = 0;
  let snapshot = EMPTY_DRAFT_TOPO;
  const listeners = new Set<() => void>();

  function emit(): void {
    if (disposed) return;
    for (const listener of [...listeners]) listener();
  }

  function replace(next: DraftTopoSnapshot): void {
    if (snapshot.previewUrl && snapshot.previewUrl !== next.previewUrl) {
      URL.revokeObjectURL(snapshot.previewUrl);
    }
    snapshot = next;
    emit();
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    beginRead() {
      const id = ++readGeneration;
      if (disposed) return id;
      replace({ ...snapshot, pending: true, error: null, gpsPrompt: null });
      return id;
    },
    isCurrentRead(id: number) {
      return !disposed && id === readGeneration;
    },
    finishRead(id: number) {
      if (id !== readGeneration || disposed || !snapshot.pending) return;
      replace({ ...snapshot, pending: false });
    },
    accept(file: File) {
      if (disposed) return;
      replace({
        file,
        error: null,
        previewUrl: URL.createObjectURL(file),
        gpsPrompt: null,
        pending: snapshot.pending,
      });
    },
    reject(id: number, message: string) {
      if (id !== readGeneration || disposed) return;
      replace({ ...snapshot, error: message, pending: false });
    },
    setGpsPrompt(geo: LatLng) {
      if (disposed) return;
      replace({ ...snapshot, gpsPrompt: geo });
    },
    dismissGpsPrompt() {
      if (disposed || snapshot.gpsPrompt == null) return;
      replace({ ...snapshot, gpsPrompt: null });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (snapshot.previewUrl) URL.revokeObjectURL(snapshot.previewUrl);
      snapshot = { ...snapshot, previewUrl: null, gpsPrompt: null };
      listeners.clear();
    },
  };
}
