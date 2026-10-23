'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');

function movieRoutes(container) {
    const router = Router();
    const ctrl = container.movieController;

    router.get('/', ctrl.getAllMovies);
    router.get('/:id', ctrl.getMovieById);
    router.post('/', authenticate, ctrl.createMovie);
    router.delete('/:id', authenticate, ctrl.deleteMovie);

    return router;
}

module.exports = movieRoutes;