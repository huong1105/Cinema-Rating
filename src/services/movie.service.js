
'use strict';

const AppError = require('../utils/app-error');

class MovieService {
  constructor({ movieRepository, genreRepository }) {
    this.movieRepository = movieRepository;
    this.genreRepository = genreRepository;
  }

  async getAllMovies() {
    return this.movieRepository.findAll();
  }

  async getMovieById(id) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID phim không hợp lệ', 400);
    }

    const movie = await this.movieRepository.findById(id);

    if (!movie) {
      throw new AppError('Không tìm thấy phim', 404);
    }

    return movie;
  }

  async createMovie(data) {
    const {
      title,
      overview,
      director,
      releaseYear,
      genreIds = [],
    } = data;

    if (typeof title !== 'string' || !title.trim()) {
      throw new AppError('Tên phim không được để trống', 400);
    }

    if (!Array.isArray(genreIds)) {
      throw new AppError('genreIds phải là một mảng', 400);
    }

    if (!genreIds.every(
      (id) => Number.isInteger(id) && id > 0
    )) {
      throw new AppError('ID thể loại không hợp lệ', 400);
    }

    if (releaseYear != null &&
      (!Number.isInteger(releaseYear) ||
        releaseYear < 1888 ||
        releaseYear > new Date().getFullYear() + 10)) {
      throw new AppError('Năm phát hành không hợp lệ', 400);
    }

    const uniqueGenreIds = [...new Set(genreIds)];

    if (uniqueGenreIds.length > 0) {
      const genres = await this.genreRepository.findByIds(
        uniqueGenreIds
      );

      if (genres.length !== uniqueGenreIds.length) {
        throw new AppError(
          'Có thể loại không tồn tại',
          400
        );
      }
    }

    return this.movieRepository.create({
      title: title.trim(),
      overview,
      director,
      releaseYear,
      genreIds: uniqueGenreIds,
    });
  }

  async deleteMovie(id) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('ID phim không hợp lệ', 400);
    }

    const movie = await this.movieRepository.findById(id);

    if (!movie) {
      throw new AppError('Không tìm thấy phim', 404);
    }

    await this.movieRepository.delete(id);

    return { message: 'Xóa phim thành công' };
  }
}

module.exports = MovieService;
