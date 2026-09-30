'use strict';

/**
 * Central error-handling middleware.
 * Express identifies error handlers by their 4-parameter signature.
 */
function errorHandler(err, _req, res, _next) {
  console.error('❌', err.stack || err.message);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

module.exports = errorHandler;
