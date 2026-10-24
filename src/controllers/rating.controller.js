'use strict';

const catchAsync = require('../utils/catch-async');

class RatingController {
  constructor({ ratingService }) {
    this.ratingService = ratingService;
  }

  rateMovie = catchAsync(async (req, res) => {
    const rating = await this.ratingService.rateMovie({
      movieId: req.params.id,
      userId: req.user.id,
      score: req.body?.score,
    });
    res.status(200).json({ message: 'Chấm điểm thành công', data: rating });
  });

  getMovieSummary = catchAsync(async (req, res) => {
    const summary = await this.ratingService.getMovieSummary(req.params.id);
    res.status(200).json({ data: summary });
  });

  getMyRatings = catchAsync(async (req, res) => {
    const ratings = await this.ratingService.getMyRatings(req.user.id);
    res.status(200).json({ data: ratings });
  });
}

module.exports = RatingController;
