'use strict';

const AppError = require('../utils/app-error');
const { parseId, validateUserId } = require('../utils/validate-id');

class ReviewService {
  constructor({ reviewRepository, movieRepository }) {
    this.reviewRepository = reviewRepository;
    this.movieRepository = movieRepository;
  }

  async addReview({ movieId, userId, content }) {
    movieId = parseId(movieId, 'ID phim');
    validateUserId(userId);
    if (typeof content !== 'string' || content.trim().length < 5) {
      throw new AppError('Nội dung đánh giá phải từ 5 ký tự trở lên', 400);
    }

    if (!await this.movieRepository.findById(movieId)) {
      throw new AppError('Không tìm thấy phim', 404);
    }

    return this.reviewRepository.create({ movieId, userId, content: content.trim() });
  }

  async getMovieReviews(movieId) {
    movieId = parseId(movieId, 'ID phim');
    if (!await this.movieRepository.findById(movieId)) {
      throw new AppError('Không tìm thấy phim', 404);
    }

    return this.reviewRepository.findByMovieId(movieId);
  }

  async deleteReview(id, userId) {
    id = parseId(id, 'ID bài đánh giá');
    validateUserId(userId);
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new AppError('Không tìm thấy bài đánh giá', 404);
    }
    if (review.userId !== userId) {
      throw new AppError('Bạn không có quyền xóa bài đánh giá của người khác', 403);
    }

    const result = await this.reviewRepository.deleteForUser(id, userId);
    if (result.count === 0) {
      throw new AppError('Không tìm thấy bài đánh giá', 404);
    }

    return { message: 'Xóa bài đánh giá thành công' };
  }
}

module.exports = ReviewService;
