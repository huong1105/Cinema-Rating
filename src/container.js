'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserRepository = require('./repositories/user.repository');
const AuthService = require('./services/auth.service');
const AuthController = require('./controllers/auth.controller');

const prisma = new PrismaClient();

const userRepository = new UserRepository(prisma);

const authService = new AuthService({
  userRepository,
  bcrypt,
  jwt,
});

const authController = new AuthController({ authService });

module.exports = {
  prisma,
  bcrypt,
  jwt,
  userRepository,
  authService,
  authController,
};
