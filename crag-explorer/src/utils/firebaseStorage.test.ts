import { describe, expect, it } from 'vitest';
import {
  getCragDataUrl,
  getCragGuideUrl,
  getCragImageUrl,
  getCragIndexUrl,
  getCragOpenTopoPackUrl,
  getCragOpenTopoTileUrl,
  getCragSectorsGpxUrl,
  getFirebaseStorageUrl,
} from './firebaseStorage';

const PROD_HOST = 'https://firebasestorage.googleapis.com/v0/b/crag-to-all.firebasestorage.app/o';

describe('firebaseStorage URLs', () => {
  it('encodes path slashes and query-wraps alt=media', () => {
    expect(getFirebaseStorageUrl('roshka/roshka.json')).toBe(
      `${PROD_HOST}/roshka%2Froshka.json?alt=media`,
    );
  });

  it('encodes spaces in image filenames', () => {
    expect(getCragImageUrl('roshka', 'a b.jpg')).toBe(
      `${PROD_HOST}/roshka%2Fimages%2Fa%20b.jpg?alt=media`,
    );
  });

  it('builds index, JSON, GPX, PDF, pack, and tile URLs', () => {
    expect(getCragIndexUrl()).toBe(`${PROD_HOST}/index.json?alt=media`);
    expect(getCragDataUrl('roshka')).toBe(
      `${PROD_HOST}/roshka%2Froshka.json?alt=media`,
    );
    expect(getCragSectorsGpxUrl('roshka')).toBe(
      `${PROD_HOST}/roshka%2Froshka-sectors.gpx?alt=media`,
    );
    expect(getCragGuideUrl('roshka')).toBe(
      `${PROD_HOST}/roshka%2Froshka-guide.pdf?alt=media`,
    );
    expect(getCragOpenTopoPackUrl('roshka')).toBe(
      `${PROD_HOST}/roshka%2Ftiles%2Fopentopo%2Fpack.zip?alt=media`,
    );
    expect(getCragOpenTopoTileUrl('roshka', 12, 2345, 67)).toBe(
      `${PROD_HOST}/roshka%2Ftiles%2Fopentopo%2F12%2F2345%2F67.png?alt=media`,
    );
  });
});
