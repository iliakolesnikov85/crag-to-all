import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { badRequest } from './http';

const IMAGE_FIELD_NAME = 'image';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

function detectImageType(buffer: Buffer): { ext: string; contentType: string } | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { ext: 'gif', contentType: 'image/gif' };
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

function hashedImageFileName(buffer: Buffer, ext: string): string {
  const hash = createHash('sha256').update(buffer).digest('hex');
  return `${hash}.${ext}`;
}

export { IMAGE_FIELD_NAME, MAX_IMAGE_BYTES };

export interface ParsedImageUpload {
  buffer: Buffer;
  imageFile: string;
  contentType: string;
}

export function cragImageStoragePath(cragId: string, imageFile: string): string {
  return `${cragId}/images/${imageFile}`;
}

export function parseUploadedImage(file: Express.Multer.File | undefined): ParsedImageUpload {
  if (!file?.buffer?.length) {
    throw badRequest('multipart field "image" with an image file is required');
  }
  const detected = detectImageType(file.buffer);
  if (!detected) {
    throw badRequest('image must be a JPEG, PNG, WebP, or GIF file');
  }
  return {
    buffer: file.buffer,
    imageFile: hashedImageFileName(file.buffer, detected.ext),
    contentType: detected.contentType,
  };
}

export const imageUploadMiddleware: RequestHandler = (req, res, next) => {
  upload.single(IMAGE_FIELD_NAME)(req, res, next);
};
