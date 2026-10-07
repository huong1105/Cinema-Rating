'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');

const router = Router();

function authRoutes(container) {
    const router = Router();
    const ctrl = container.authController;

    router.post('/register', ctrl.register);
    router.post('/login', ctrl.login);

    router.get('/profile', authenticate, ctrl.getProfile);
    router.put('/profile', authenticate, ctrl.updateProfile);

    return router;
}

module.exports = authRoutes;
