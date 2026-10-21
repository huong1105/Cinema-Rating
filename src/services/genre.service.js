
'use strict';

class GenreService {
  constructor({ genreRepository }) {
    this.genreRepository = genreRepository;
  }

  async getAllGenres() {
    return this.genreRepository.findAll();
  }
}

module.exports = GenreService;
