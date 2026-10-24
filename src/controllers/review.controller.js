'use strict';

const catchAsync = require('../utils/catch-async');

class ReviewController {
  constructor({ reviewService }) {
    this.reviewService = reviewService;
  }

  addReview = catchAsync(async (req, res) => {
    const review = await this.reviewService.addReview({
      movieId: req.params.id,
      userId: req.user.id,
      content: req.body?.content,
    });
    res.status(201).json({ message: 'Tạo bài đánh giá thành công', data: review });
  });

  getMovieReviews = catchAsync(async (req, res) => {
    const reviews = await this.reviewService.getMovieReviews(req.params.id);
    res.status(200).json({ data: reviews });
  });

  deleteReview = catchAsync(async (req, res) => {
    const result = await this.reviewService.deleteReview(req.params.id, req.user.id);
    res.status(200).json(result);
  });
}

module.exports = ReviewController;
