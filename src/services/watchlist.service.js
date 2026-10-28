'use strict';

const AppError = require('../utils/app-error');
const { parseId, validateUserId } = require('../utils/validate-id');

class WatchlistService {
  constructor({ watchlistRepository, movieRepository }) {
    this.watchlistRepository = watchlistRepository;
    this.movieRepository = movieRepository;
  }

  async getMyWatchlist(userId) {
    validateUserId(userId);
    return this.watchlistRepository.findByUserId(userId);
  }

  async addMovie({ movieId, userId }) {
    // Unlike a URL parameter, a JSON movieId must be a number.
    if (typeof movieId !== 'number') {
      throw new AppError('movieId phải là số nguyên dương', 400);
    }
    movieId = parseId(movieId, 'ID phim');
    validateUserId(userId);
    if (!await this.movieRepository.findById(movieId)) {
      throw new AppError('Không tìm thấy phim', 404);
    }

    try {
      return await this.watchlistRepository.create({ userId, movieId });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new AppError('Phim đã có trong Watchlist', 409);
      }
      if (err.code === 'P2003') {
        throw new AppError('Phim hoặc người dùng không còn tồn tại', 404);
      }
      throw err;
    }
  }

  async removeMovie(movieId, userId) {
    movieId = parseId(movieId, 'ID phim');
    validateUserId(userId);
    const result = await this.watchlistRepository.deleteForUser(userId, movieId);
    if (result.count === 0) {
      throw new AppError('Phim không có trong Watchlist của bạn', 404);
    }

    return { message: 'Xóa phim khỏi Watchlist thành công' };
  }
}

module.exports = WatchlistService;
