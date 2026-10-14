import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../errors/app_error';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

function formatIssues(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  return issues.map((issue) => ({
    field: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) throw new ValidationError('Invalid request body', formatIssues(result.error.issues));
      req.body = result.data;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) throw new ValidationError('Invalid URL parameters', formatIssues(result.error.issues));
      req.params = result.data as typeof req.params;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) throw new ValidationError('Invalid query string', formatIssues(result.error.issues));
      Object.defineProperty(req, 'query', {
        value: result.data,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    next();
  };
}