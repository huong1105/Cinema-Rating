'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');

function ratingRoutes(container) {
  const router = Router();
  const ctrl = container.ratingController;

  router.post('/movies/:id/ratings', authenticate, ctrl.rateMovie);
  router.get('/movies/:id/ratings/summary', ctrl.getMovieSummary);
  router.get('/ratings/me', authenticate, ctrl.getMyRatings);

  return router;
}

module.exports = ratingRoutes;
