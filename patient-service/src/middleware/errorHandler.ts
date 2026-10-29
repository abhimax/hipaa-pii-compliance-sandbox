import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, NotFoundError } from '../errors/AppError.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
};

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (err instanceof AppError) {
    const body: ErrorBody = { error: { code: err.code, message: err.message } };
    if (err.details !== undefined) body.error.details = err.details;
    res.status(err.statusCode).json(body);
    return;
  }

  // Malformed JSON raised by express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } } satisfies ErrorBody);
    return;
  }

  console.error('Unhandled error:', err instanceof Error ? err.stack : String(err), 'body:', JSON.stringify(req.body));
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Internal server error', details: { request: req.body } },
  } satisfies ErrorBody);
};
