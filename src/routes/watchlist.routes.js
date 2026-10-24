'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');

function watchlistRoutes(container) {
  const router = Router();
  const ctrl = container.watchlistController;

  router.get('/', authenticate, ctrl.getMyWatchlist);
  router.post('/', authenticate, ctrl.addMovie);
  router.delete('/:movieId', authenticate, ctrl.removeMovie);

  return router;
}

module.exports = watchlistRoutes;
