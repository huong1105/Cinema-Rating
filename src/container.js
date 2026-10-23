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

const prisma = new PrismaClient();

const userRepository = new UserRepository(prisma);
const movieRepository = new MovieRepository(prisma);
const genreRepository = new GenreRepository(prisma);

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

const authController = new AuthController({ authService });
const movieController = new MovieController({ movieService });
const genreController = new GenreController({ genreService });

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
};
