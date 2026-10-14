import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors/app_error';
import { ERROR_CODES } from '../errors/error_codes';
import { logger } from '../logger';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: ERROR_CODES.NOT_FOUND, message: `Route not found: ${req.method} ${req.path}` },
  });
};

function bodyParserErrorType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  const bodyErrorType = bodyParserErrorType(err);
  if (bodyErrorType === 'entity.parse.failed') {
    res.status(400).json({
      error: { code: ERROR_CODES.INVALID_JSON, message: 'Request body is not valid JSON' },
    });
    return;
  }
  if (bodyErrorType === 'entity.too.large') {
    res.status(413).json({
      error: { code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: 'Request body is too large' },
    });
    return;
  }

  logger.error({ err }, 'unhandled error');
  res.status(500).json({
    error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Internal server error' },
  });
};