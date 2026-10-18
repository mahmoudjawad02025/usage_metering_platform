import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ConflictError, ValidationError } from '../../src/core/errors/app_error';
import { errorHandler } from '../../src/core/middleware/error_handler.middleware';

function fakeResponse(headersSent: boolean) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { response: { headersSent, status } as unknown as Response, status, json };
}

const request = {} as Request;

describe('errorHandler', () => {
  it('hands the error to Express when the response has already started', () => {
    const { response, status } = fakeResponse(true);
    const next = vi.fn();
    const error = new Error('failed after the first bytes were sent');

    errorHandler(error, request, response, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(status).not.toHaveBeenCalled();
  });

  it('turns an application error into its status and its code', () => {
    const { response, status, json } = fakeResponse(false);

    errorHandler(new ConflictError('already exists'), request, response, vi.fn());

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'CONFLICT', message: 'already exists', details: undefined },
    });
  });

  it('includes the details of a validation error', () => {
    const { response, status, json } = fakeResponse(false);
    const details = [{ field: 'units', message: 'Too small' }];

    errorHandler(new ValidationError('Invalid request body', details), request, response, vi.fn());

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details },
    });
  });
});