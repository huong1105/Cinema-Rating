'use strict';

/**
 * Wraps an async Express handler so rejected promises
 * are forwarded to the error middleware automatically.
 */
function catchAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = catchAsync;
