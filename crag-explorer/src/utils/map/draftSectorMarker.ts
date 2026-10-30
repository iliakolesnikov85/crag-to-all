import * as L from 'leaflet';
import type { CragContextType } from '../../context/CragContext';
import type { LatLng, Sector } from '../../types';
import { createDraftTopo, type DraftTopo } from './draftTopo';
import {
  bindSectorDrag,
  bindSectorPopup,
  createSectorMarkerHost,
  createSectorMarkerIcon,
  type SectorMarkerMode,
  type SectorPopupMoveGuard,
} from './mapOverlays';
import { createSectorGeoEditor, type SectorGeoEditor } from './sectorGeoEditor';

const DRAFT_SECTOR_LABEL = 'New sector';

export interface NewSectorInput {
  name: string;
  geo: LatLng;
  images?: Array<{ imageFile: string }>;
}

export interface DraftSectorMarkerOptions {
  map: L.Map;
  geo: LatLng;
  mode: SectorMarkerMode;
  takenNames: readonly string[];
  cragContext: CragContextType;
  navigate: (to: string) => void;
  createSector: (sector: NewSectorInput) => Promise<Sector>;
  uploadImage: (file: File) => Promise<{ imageFile: string }>;
  onCreated?: (sector: Sector) => void;
  /** Called once the draft is gone: after Cancel, a closed popup, a successful save, or `remove()`. */
  onClose?: () => void;
  onDragChange?: (dragging: boolean) => void;
}

export interface DraftSectorMarker {
  sector: Sector;
  editor: SectorGeoEditor;
  topo: DraftTopo;
  remove(): void;
}

/** Add a temporary marker for a sector that is not saved yet, already in edit mode. */
export function addDraftSectorMarker(options: DraftSectorMarkerOptions): DraftSectorMarker {
  const { map, geo, mode } = options;
  const sector: Sector = { name: '', geo, routes: [], images: [] };
  const topo = createDraftTopo();
  const marker = L.marker([geo.lat, geo.lon], {
    icon: createSectorMarkerIcon({ ...sector, name: DRAFT_SECTOR_LABEL }),
    autoPan: true,
  });
  const popupMoveGuard: SectorPopupMoveGuard = { moving: false };
  const baseHost = createSectorMarkerHost(marker, map, popupMoveGuard, {
    async save(patch) {
      if (!patch.name || !patch.geo) {
        throw new Error('A new sector needs a name and a location.');
      }
      const file = topo.getSnapshot().file;
      const created = await options.createSector({
        name: patch.name,
        geo: patch.geo,
        ...(file ? { images: [await options.uploadImage(file)] } : {}),
      });
      options.onCreated?.(created);
      return created;
    },
    onDragChange: options.onDragChange,
  });
  const editor = createSectorGeoEditor({
    geo,
    name: '',
    takenNames: options.takenNames,
    isNew: true,
    host: {
      ...baseHost,
      setEditing(editing) {
        baseHost.setEditing(editing);
        // A draft only exists while it is being edited. Leaving edit mode means
        // it was either discarded or saved as a real sector.
        if (!editing) marker.remove();
      },
    },
  });

  marker.on('remove', () => {
    editor.dispose();
    topo.dispose();
    options.onClose?.();
  });
  bindSectorDrag(marker, editor);
  if (mode === 'bottom-panel') {
    // A tap on the pin must not reach the map. The map treats its own click as
    // "discard this draft", and a short drag that never starts is still a click.
    marker.on('click', (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event);
      if (event.originalEvent) {
        L.DomEvent.stopPropagation(event.originalEvent);
      }
    });
  } else {
    bindSectorPopup(
      marker,
      { sector, navigate: options.navigate, geoEditor: editor, topo, isNew: true },
      options.cragContext,
      popupMoveGuard,
    );
  }

  marker.addTo(map);
  editor.startEdit();
  if (mode === 'popup') marker.openPopup();

  return {
    sector,
    editor,
    topo,
    remove() {
      marker.remove();
    },
  };
}
