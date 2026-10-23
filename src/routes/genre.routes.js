'use strict';

const { Router } = require('express');

function genreRoutes(container) {
    const router = Router();
    const ctrl = container.genreController;

    router.get('/', ctrl.getAllGenres);

    return router;
}

module.exports = genreRoutes;