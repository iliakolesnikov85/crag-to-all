import { useCallback, useEffect, useRef, useState } from 'react';
import type { SectorEditor } from '../../hooks/useSectorEditor';
import type { LatLng } from '../../types';
import { formatSectorCoordinate, parseLatitude, parseLongitude, sameSectorGeo } from '../../utils/map/sectorCoordinates';
import type { SectorEditState } from '../../utils/map/sectorEditState';
import { TOPO_TYPE_ERROR, readTopoGps, validateTopoFile } from '../../utils/topoImage';

function editedGeo(edit: SectorEditState): LatLng | null {
  const lat = parseLatitude(edit.latText);
  const lon = parseLongitude(edit.lonText);
  if (!lat.ok || !lon.ok) return null;
  return { lat: lat.value, lon: lon.value };
}

export interface TopoPicker {
  previewUrl: string | null;
  error: string | null;
  /** True while a chosen file is still being checked or its location is being read. */
  pending: boolean;
  /** Set when the chosen photo has a location different from the draft pin. */
  gpsPrompt: LatLng | null;
  chooseFile(file: File): void;
  usePhotoLocation(): void;
  dismissGpsPrompt(): void;
}

/**
 * Topo photo for a draft sector. The file lives in the editor so Save can upload
 * it; validation, preview, and the location prompt are local to the card.
 */
export function useTopoPicker(edit: SectorEditState | null, editor: SectorEditor | null): TopoPicker {
  const file = edit?.topoFile ?? null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [gpsPrompt, setGpsPrompt] = useState<LatLng | null>(null);
  const readGeneration = useRef(0);
  const editorRef = useRef(editor);
  editorRef.current = editor;

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = useCallback((chosen: File) => {
    const readId = ++readGeneration.current;
    const isCurrent = () => readId === readGeneration.current;
    setPending(true);
    setError(null);
    setGpsPrompt(null);

    void (async () => {
      try {
        const validation = await validateTopoFile(chosen);
        if (!isCurrent()) return;
        if (!validation.ok) {
          setError(validation.error);
          setPending(false);
          return;
        }
      } catch (readError) {
        console.error('Could not read the selected image:', readError);
        if (!isCurrent()) return;
        setError(TOPO_TYPE_ERROR);
        setPending(false);
        return;
      }
      editorRef.current?.setTopoFile(chosen);
      let gps: LatLng | null;
      try {
        gps = await readTopoGps(chosen);
      } catch (gpsError) {
        console.warn('Could not read photo location:', gpsError);
        if (isCurrent()) setPending(false);
        return;
      }
      if (!isCurrent()) return;
      setPending(false);
      if (!gps) return;
      const current = editorRef.current?.state ? editedGeo(editorRef.current.state) : null;
      if (current && sameSectorGeo(current, gps)) return;
      setGpsPrompt(gps);
    })();
  }, []);

  const usePhotoLocation = useCallback(() => {
    const current = editorRef.current;
    if (!gpsPrompt || !current?.state || current.state.saving) return;
    current.setLatText(formatSectorCoordinate(gpsPrompt.lat));
    current.setLonText(formatSectorCoordinate(gpsPrompt.lon));
    current.commitDraft();
    setGpsPrompt(null);
  }, [gpsPrompt]);

  const dismissGpsPrompt = useCallback(() => setGpsPrompt(null), []);

  return { previewUrl, error, pending, gpsPrompt, chooseFile, usePhotoLocation, dismissGpsPrompt };
}
