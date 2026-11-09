import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from '../../types';
import { sameSectorGeo } from '../../utils/map/sectorCoordinates';
import { TOPO_TYPE_ERROR, readTopoGps, validateTopoFile } from '../../utils/topoImage';

interface UseTopoFileOptions {
  file: File | null;
  /** When false, a valid photo is kept and its GPS is not read. */
  checkLocation: boolean;
  /** Location compared with the photo. Read when the GPS check finishes. */
  currentGeo: LatLng | null;
  saving?: boolean;
  onAccept(file: File): void;
  onUseLocation(geo: LatLng): void;
}

export interface TopoFileState {
  previewUrl: string | null;
  error: string | null;
  /** True while a chosen file is still being checked or its location is being read. */
  pending: boolean;
  /** Set when the chosen photo has a location different from `currentGeo`. */
  gpsPrompt: LatLng | null;
  chooseFile(file: File): void;
  usePhotoLocation(): void;
  dismissGpsPrompt(): void;
}

/** Validate a topo, preview it, and offer its GPS when that should move a sector. */
export function useTopoFile({
  file,
  checkLocation,
  currentGeo,
  saving = false,
  onAccept,
  onUseLocation,
}: UseTopoFileOptions): TopoFileState {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [gpsPrompt, setGpsPrompt] = useState<LatLng | null>(null);
  const readGeneration = useRef(0);
  const optionsRef = useRef({ checkLocation, currentGeo, saving, onAccept, onUseLocation });
  optionsRef.current = { checkLocation, currentGeo, saving, onAccept, onUseLocation };

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
      optionsRef.current.onAccept(chosen);
      if (!optionsRef.current.checkLocation) {
        if (isCurrent()) setPending(false);
        return;
      }
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
      const current = optionsRef.current.currentGeo;
      if (current && sameSectorGeo(current, gps)) return;
      setGpsPrompt(gps);
    })();
  }, []);

  const usePhotoLocation = useCallback(() => {
    if (!gpsPrompt || optionsRef.current.saving) return;
    optionsRef.current.onUseLocation(gpsPrompt);
    setGpsPrompt(null);
  }, [gpsPrompt]);

  const dismissGpsPrompt = useCallback(() => setGpsPrompt(null), []);

  return { previewUrl, error, pending, gpsPrompt, chooseFile, usePhotoLocation, dismissGpsPrompt };
}
