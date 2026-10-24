'use strict';

const catchAsync = require('../utils/catch-async');

class WatchlistController {
  constructor({ watchlistService }) {
    this.watchlistService = watchlistService;
  }

  getMyWatchlist = catchAsync(async (req, res) => {
    const watchlist = await this.watchlistService.getMyWatchlist(req.user.id);
    res.status(200).json({ data: watchlist });
  });

  addMovie = catchAsync(async (req, res) => {
    const item = await this.watchlistService.addMovie({
      movieId: req.body?.movieId,
      userId: req.user.id,
    });
    res.status(201).json({ message: 'Đã thêm phim vào Watchlist', data: item });
  });

  removeMovie = catchAsync(async (req, res) => {
    const result = await this.watchlistService.removeMovie(req.params.movieId, req.user.id);
    res.status(200).json(result);
  });
}

module.exports = WatchlistController;
