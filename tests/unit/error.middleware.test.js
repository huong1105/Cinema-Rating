'use strict';

const errorHandler = require('../../src/middlewares/error.middleware');

test('production errors hide database details and stack traces', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  try {
    errorHandler(new Error('Sensitive database detail'), {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'Internal Server Error' } });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
    log.mockRestore();
  }
});
