import { errorHandler } from '../errorHandler';
import { notFoundHandler } from '../notFoundHandler';
import { ValidationError } from '../../models/validation';
import { Request, Response, NextFunction } from 'express';

function createMockReq(partial: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    url: '/test',
    path: '/test',
    headers: {},
    body: {},
    params: {},
    query: {},
    ...partial
  } as unknown as Request;
}

function createMockRes() {
  const res: Partial<Response> & { statusCode?: number; jsonBody?: any } = {};
  res.status = ((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as any;
  res.json = ((body: any) => {
    (res as any).jsonBody = body;
    return res as Response;
  }) as any;
  res.setHeader = (() => {}) as any;
  return res as Response & { statusCode?: number; jsonBody?: any };
}

describe('errorHandler', () => {
  it('maps ValidationError to 400 VALIDATION_ERROR with details', () => {
    const err = new ValidationError('Invalid input', []);
    const req = createMockReq();
    const res = createMockRes();
    const next = (() => {}) as NextFunction;

    errorHandler(err as any, req, res, next);

    expect((res as any).statusCode).toBe(400);
    expect((res as any).jsonBody.error.code).toBe('VALIDATION_ERROR');
    expect((res as any).jsonBody.error.message).toBe('Invalid input');
  });

  it('respects provided statusCode/code on APIError', () => {
    const err = new Error('Not here') as any;
    err.statusCode = 404;
    err.code = 'NOT_FOUND';

    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err, req, res, (() => {}) as NextFunction);

    expect((res as any).statusCode).toBe(404);
    expect((res as any).jsonBody.error.code).toBe('NOT_FOUND');
  });

  it('defaults unknown errors to 500 INTERNAL_ERROR', () => {
    const err = new Error('Boom');
    const req = createMockReq();
    const res = createMockRes();

    errorHandler(err as any, req, res, (() => {}) as NextFunction);

    expect((res as any).statusCode).toBe(500);
    expect((res as any).jsonBody.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('notFoundHandler', () => {
  it('returns 404 with structured error body', () => {
    const req = createMockReq({ method: 'POST', path: '/unknown' });
    const res = createMockRes();

    notFoundHandler(req, res);

    expect((res as any).statusCode).toBe(404);
    expect((res as any).jsonBody.error.code).toBe('NOT_FOUND');
    expect((res as any).jsonBody.error.message).toContain('Route POST /unknown not found');
  });
});
