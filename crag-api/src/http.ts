import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function isMulterError(
  err: unknown,
): err is { name: 'MulterError'; code: string; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'MulterError' &&
    typeof (err as { code?: unknown }).code === 'string' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

export class HttpError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    const message =
      typeof payload.message === 'string' ? payload.message : `HTTP ${status}`;
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.payload = payload;
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, { error: 'invalid_request', message });
}

export function notFound(entity: string): HttpError {
  return new HttpError(404, { error: 'not_found', message: `${entity} not found` });
}

export function versionConflict(currentVersion: number): HttpError {
  return new HttpError(409, { error: 'version_conflict', currentVersion });
}

export function alreadyExists(message: string): HttpError {
  return new HttpError(409, { error: 'already_exists', message });
}

export function readOnly(message: string): HttpError {
  return new HttpError(403, { error: 'read_only', message });
}

export function storageUnavailable(message = 'Image storage is not configured'): HttpError {
  return new HttpError(503, { error: 'storage_unavailable', message });
}

export function storageFailed(message = 'Could not upload image to Storage'): HttpError {
  return new HttpError(502, { error: 'storage_failed', message });
}

export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 11000
  );
}

export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json(err.payload);
    return;
  }
  if (isMulterError(err)) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'payload_too_large',
        message: 'Image must be at most 10MB',
      });
      return;
    }
    res.status(400).json({ error: 'invalid_request', message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const path = issue?.path.join('.') ?? '';
    const detail = issue?.message ?? 'Invalid request';
    res.status(400).json({
      error: 'invalid_request',
      message: path ? `${path}: ${detail}` : detail,
    });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'invalid_json', message: 'Request body is not valid JSON' });
    return;
  }
  if (isDuplicateKeyError(err)) {
    res.status(409).json({ error: 'already_exists', message: 'A document with that id already exists' });
    return;
  }
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: 'internal_error' });
}
