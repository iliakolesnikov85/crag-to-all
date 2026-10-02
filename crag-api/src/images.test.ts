import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HttpError } from './http';
import { cragImageStoragePath, parseUploadedImage } from './images';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function multerFile(buffer: Buffer, originalname: string): Express.Multer.File {
  return {
    fieldname: 'image',
    originalname,
    encoding: '7bit',
    mimetype: 'application/octet-stream',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as unknown as Express.Multer.File['stream'],
  };
}

describe('parseUploadedImage', () => {
  it('names the object from a content hash and detected type', () => {
    const parsed = parseUploadedImage(multerFile(PNG_1X1, 'wall.jpg'));
    const hash = createHash('sha256').update(PNG_1X1).digest('hex');
    expect(parsed.imageFile).toBe(`${hash}.png`);
    expect(parsed.contentType).toBe('image/png');
    expect(cragImageStoragePath('roshka', parsed.imageFile)).toBe(
      `roshka/images/${hash}.png`,
    );
  });

  it('rejects a missing file and non-image bytes', () => {
    try {
      parseUploadedImage(undefined);
      throw new Error('expected parseUploadedImage to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }

    try {
      parseUploadedImage(multerFile(Buffer.from('not-an-image'), 'notes.txt'));
      throw new Error('expected parseUploadedImage to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(400);
    }
  });
});
