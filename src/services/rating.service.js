'use strict';

const AppError = require('../utils/app-error');
const { parseId, validateUserId } = require('../utils/validate-id');

class RatingService {
  constructor({ ratingRepository, movieRepository }) {
    this.ratingRepository = ratingRepository;
    this.movieRepository = movieRepository;
  }

  async rateMovie({ movieId, userId, score }) {
    movieId = parseId(movieId, 'ID phim');
    validateUserId(userId);
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 1 || score > 10) {
      throw new AppError('Điểm đánh giá phải là số từ 1 đến 10', 400);
    }

    if (!await this.movieRepository.findById(movieId)) {
      throw new AppError('Không tìm thấy phim', 404);
    }

    try {
      return await this.ratingRepository.upsert({ movieId, userId, score });
    } catch (err) {
      if (err.code === 'P2003' || err.code === 'P2025') {
        throw new AppError('Phim hoặc người dùng không còn tồn tại', 404);
      }
      throw err;
    }
  }

  async getMovieSummary(movieId) {
    movieId = parseId(movieId, 'ID phim');
    if (!await this.movieRepository.findById(movieId)) {
      throw new AppError('Không tìm thấy phim', 404);
    }

    return this.ratingRepository.getSummary(movieId);
  }

  async getMyRatings(userId) {
    validateUserId(userId);
    return this.ratingRepository.findByUserId(userId);
  }
}

module.exports = RatingService;
