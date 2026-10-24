'use strict';

const { Router } = require('express');
const { authenticate } = require('../middlewares/auth.middleware');

function reviewRoutes(container) {
  const router = Router();
  const ctrl = container.reviewController;

  router.get('/movies/:id/reviews', ctrl.getMovieReviews);
  router.post('/movies/:id/reviews', authenticate, ctrl.addReview);
  router.delete('/reviews/:id', authenticate, ctrl.deleteReview);

  return router;
}

module.exports = reviewRoutes;
