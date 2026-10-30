import exifr from 'exifr';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_TOPO_IMAGE_BYTES,
  TOPO_SIZE_ERROR,
  TOPO_TYPE_ERROR,
  readTopoGps,
  validateTopoFile,
} from './topoImage';

vi.mock('exifr', () => ({
  default: {
    gps: vi.fn(),
  },
}));

function fileWith(bytes: number[], name: string): File {
  return new File([new Uint8Array(bytes)], name);
}

function jpegBytes(): number[] {
  return [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
}

describe('validateTopoFile', () => {
  it('accepts JPEG, PNG, GIF, and WebP headers', async () => {
    await expect(validateTopoFile(fileWith(jpegBytes(), 'topo.jpg'))).resolves.toEqual({ ok: true });
    await expect(validateTopoFile(fileWith(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0],
      'topo.png',
    ))).resolves.toEqual({ ok: true });
    await expect(validateTopoFile(fileWith(
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0],
      'topo.gif',
    ))).resolves.toEqual({ ok: true });
    await expect(validateTopoFile(fileWith(
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
      'topo.webp',
    ))).resolves.toEqual({ ok: true });
  });

  it('rejects a non-image and a header that is too short', async () => {
    const notes = fileWith([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21], 'notes.txt');
    await expect(validateTopoFile(notes)).resolves.toEqual({
      ok: false,
      error: TOPO_TYPE_ERROR,
    });
    await expect(validateTopoFile(fileWith([0xff, 0xd8, 0xff], 'short.jpg'))).resolves.toEqual({
      ok: false,
      error: TOPO_TYPE_ERROR,
    });
  });

  it('rejects a file larger than 10 MB and accepts one at the limit', async () => {
    expect(MAX_TOPO_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(TOPO_SIZE_ERROR).toBe('Image must be 10 MB or smaller.');
    const over = fileWith(jpegBytes(), 'big.jpg');
    Object.defineProperty(over, 'size', { value: MAX_TOPO_IMAGE_BYTES + 1 });
    await expect(validateTopoFile(over)).resolves.toEqual({
      ok: false,
      error: TOPO_SIZE_ERROR,
    });

    const atLimit = fileWith(jpegBytes(), 'limit.jpg');
    Object.defineProperty(atLimit, 'size', { value: MAX_TOPO_IMAGE_BYTES });
    expect(atLimit.size).toBe(MAX_TOPO_IMAGE_BYTES);
    await expect(validateTopoFile(atLimit)).resolves.toEqual({ ok: true });
  });
});

describe('readTopoGps', () => {
  const file = fileWith(jpegBytes(), 'topo.jpg');

  it('returns latitude and longitude from the photo', async () => {
    vi.mocked(exifr.gps).mockResolvedValue({ latitude: 41.1, longitude: 44.2 });
    await expect(readTopoGps(file)).resolves.toEqual({ lat: 41.1, lon: 44.2 });
  });

  it('returns null when the photo has no usable location', async () => {
    vi.mocked(exifr.gps).mockResolvedValue(undefined as unknown as { latitude: number; longitude: number });
    await expect(readTopoGps(file)).resolves.toBeNull();

    vi.mocked(exifr.gps).mockResolvedValue({ latitude: 91, longitude: 0 });
    await expect(readTopoGps(file)).resolves.toBeNull();

    vi.mocked(exifr.gps).mockResolvedValue({ latitude: Number.NaN, longitude: 0 });
    await expect(readTopoGps(file)).resolves.toBeNull();
  });
});
