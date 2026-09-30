'use strict';

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cinerate-secret-key';

/**
 * ┌─────────────────────────────────────────────────────────┐
 *  Middleware xác thực JWT tập trung
 * │─────────────────────────────────────────────────────────│
 *  Nhiệm vụ của [Thành viên A]:
 *  1. Đọc header `req.headers.authorization`
 *  2. Kiểm tra format `Bearer <token>`
 *  3. Dùng `jwt.verify(token, JWT_SECRET)` để giải mã
 *  4. Gán payload đã giải mã vào `req.user`
 *  5. Gọi `next()` để cho phép request đi tiếp
 * └─────────────────────────────────────────────────────────┘
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yêu cầu đăng nhập. Vui lòng cung cấp Bearer token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

module.exports = { authenticate };
