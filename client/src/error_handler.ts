import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ServiceError } from './metering_client';
export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route' } });
};
function clientErrorStatus(err: unknown): number | null {
  if (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  ) {
    return err.status;
  }
  return null;
}
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.issues.map((issue) => ({
          field: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }
  if (err instanceof ServiceError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  if (err instanceof TypeError && err.message === 'fetch failed') {
    res.status(502).json({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'The metering service cannot be reached' },
    });
    return;
  }
  const status = clientErrorStatus(err);
  if (status !== null) {
    res.status(status).json({ error: { code: 'BAD_REQUEST', message: 'The request could not be read' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
};