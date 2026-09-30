'use strict';

const catchAsync = require('../utils/catch-async');

class AuthController {
  constructor({ authService }) {
    this.authService = authService;
  }

  register = catchAsync(async (req, res) => {
    const user = await this.authService.register(req.body);
    res.status(201).json({ message: 'Đăng ký thành công', data: user });
  });

  login = catchAsync(async (req, res) => {
    const result = await this.authService.login(req.body);
    res.status(200).json({ message: 'Đăng nhập thành công', data: result });
  });

  getProfile = catchAsync(async (req, res) => {
    const profile = await this.authService.getProfile(req.user.id);
    res.status(200).json({ data: profile });
  });
}

module.exports = AuthController;
