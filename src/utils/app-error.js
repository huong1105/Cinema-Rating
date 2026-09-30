'use strict';

/**
 * Custom application error with HTTP status code.
 * Throw from Services; caught by the error middleware.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
