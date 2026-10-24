'use strict';

function errorHandler(err, _req, res, _next) {
  console.error(err.stack || err.message);

  const status = err.statusCode || err.status || 500;
  const message = status >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  res.status(status).json({
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

module.exports = errorHandler;
