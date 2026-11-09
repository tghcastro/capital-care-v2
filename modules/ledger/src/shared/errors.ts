/**
 * Custom error classes for the ledger module
 *
 * Errors thrown from services are caught by Express error middleware
 * and serialized as RFC 7807 Problem Details responses.
 */

export abstract class DomainError extends Error {
  abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends DomainError {
  readonly statusCode = 404;

  constructor(message: string = 'Resource not found') {
    super(message);
  }
}

export class ConflictError extends DomainError {
  readonly statusCode = 409;

  constructor(message: string = 'Resource conflict') {
    super(message);
  }
}

export class ValidationError extends DomainError {
  readonly statusCode = 422;
  readonly details: Array<{ field: string; message: string }>;

  constructor(message: string, details: Array<{ field: string; message: string }> = []) {
    super(message);
    this.details = details;
  }
}

export class UnauthorizedError extends DomainError {
  readonly statusCode = 401;

  constructor(message: string = 'Unauthorized') {
    super(message);
  }
}
