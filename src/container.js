'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserRepository = require('./repositories/user.repository');
const AuthService = require('./services/auth.service');
const AuthController = require('./controllers/auth.controller');
const MovieRepository = require('./repositories/movie.repository');
const GenreRepository = require('./repositories/genre.repository');
const MovieService = require('./services/movie.service');
const GenreService = require('./services/genre.service');
const MovieController = require('./controllers/movie.controller');
const GenreController = require('./controllers/genre.controller');
const RatingRepository = require('./repositories/rating.repository');
const ReviewRepository = require('./repositories/review.repository');
const WatchlistRepository = require('./repositories/watchlist.repository');
const RatingService = require('./services/rating.service');
const ReviewService = require('./services/review.service');
const WatchlistService = require('./services/watchlist.service');
const RatingController = require('./controllers/rating.controller');
const ReviewController = require('./controllers/review.controller');
const WatchlistController = require('./controllers/watchlist.controller');

const prisma = new PrismaClient();

const userRepository = new UserRepository(prisma);
const movieRepository = new MovieRepository(prisma);
const genreRepository = new GenreRepository(prisma);
const ratingRepository = new RatingRepository(prisma);
const reviewRepository = new ReviewRepository(prisma);
const watchlistRepository = new WatchlistRepository(prisma);

const authService = new AuthService({
  userRepository,
  bcrypt,
  jwt,
});
const movieService = new MovieService({
  movieRepository,
  genreRepository,
});
const genreService = new GenreService({
  genreRepository,
});
const ratingService = new RatingService({ ratingRepository, movieRepository });
const reviewService = new ReviewService({ reviewRepository, movieRepository });
const watchlistService = new WatchlistService({ watchlistRepository, movieRepository });

const authController = new AuthController({ authService });
const movieController = new MovieController({ movieService });
const genreController = new GenreController({ genreService });
const ratingController = new RatingController({ ratingService });
const reviewController = new ReviewController({ reviewService });
const watchlistController = new WatchlistController({ watchlistService });

module.exports = {
  prisma,
  bcrypt,
  jwt,
  userRepository,
  authService,
  authController,
  movieRepository,
  genreRepository,
  movieService,
  genreService,
  movieController,
  genreController,
  ratingRepository,
  reviewRepository,
  watchlistRepository,
  ratingService,
  reviewService,
  watchlistService,
  ratingController,
  reviewController,
  watchlistController,
};
