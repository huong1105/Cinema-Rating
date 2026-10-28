'use strict';

const AppError = require('./app-error');

function parseId(value, label = 'ID') {
  const id = typeof value === 'string' && /^[1-9]\d*$/.test(value)
    ? Number(value)
    : value;

  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    throw new AppError(`${label} không hợp lệ`, 400);
  }

  return id;
}

function validateUserId(userId) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
    throw new AppError('Thông tin đăng nhập không hợp lệ', 401);
  }

  return userId;
}

module.exports = { parseId, validateUserId };
