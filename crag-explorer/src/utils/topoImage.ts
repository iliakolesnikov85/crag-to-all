import exifr from 'exifr';
import type { LatLng } from '../types';

const MAX_TOPO_IMAGE_BYTES = 10 * 1024 * 1024;
const TOPO_TYPE_ERROR = 'Use a JPEG, PNG, WebP, or GIF image.';
const TOPO_SIZE_ERROR = 'Image must be 10 MB or smaller.';

interface TopoValidationSuccess {
  ok: true;
}

interface TopoValidationFailure {
  ok: false;
  error: string;
}

function isSupportedImage(bytes: Uint8Array): boolean {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return true;
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return true;
  }
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return riff === 'RIFF' && webp === 'WEBP';
}

export type TopoValidation = TopoValidationSuccess | TopoValidationFailure;

export { MAX_TOPO_IMAGE_BYTES, TOPO_SIZE_ERROR, TOPO_TYPE_ERROR };

/** Reject anything the image API will not store. The limit is 10 MB. */
export async function validateTopoFile(file: File): Promise<TopoValidation> {
  if (file.size > MAX_TOPO_IMAGE_BYTES) {
    return { ok: false, error: TOPO_SIZE_ERROR };
  }
  if (file.size < 12) {
    return { ok: false, error: TOPO_TYPE_ERROR };
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (!isSupportedImage(header)) {
    return { ok: false, error: TOPO_TYPE_ERROR };
  }
  return { ok: true };
}

/** GPS from the photo, when the file has it. Throws if the metadata cannot be read. */
export async function readTopoGps(file: File): Promise<LatLng | null> {
  const gps = await exifr.gps(file);
  if (!gps) return null;
  const { latitude, longitude } = gps;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { lat: latitude, lon: longitude };
}
