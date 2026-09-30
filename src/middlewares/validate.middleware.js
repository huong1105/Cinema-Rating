'use strict';

/**
 * Zod validation middleware factory.
 *
 * @param {import('zod').ZodSchema} schema – A Zod schema to validate against.
 * @param {'body' | 'query' | 'params'} source – Which part of the request to validate.
 * @returns {import('express').RequestHandler}
 *
 * Usage:
 *   router.post('/movies', validate(createMovieSchema, 'body'), controller.create);
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
    }

    // Replace raw data with parsed (coerced/transformed) data
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
