'use strict';

const GenreService = require('../../src/services/genre.service');

describe('GenreService', () => {
  let service;
  let genreRepository;

  beforeEach(() => {
    genreRepository = {
      findAll: jest.fn().mockResolvedValue([
        { id: 1, name: 'Action' },
        { id: 2, name: 'Comedy' },
      ]),
    };
    service = new GenreService({ genreRepository });
  });

  describe('getAllGenres', () => {
    test('resolves all genres from repository', async () => {
      const genres = await service.getAllGenres();
      expect(genres).toHaveLength(2);
      expect(genres[0]).toEqual({ id: 1, name: 'Action' });
      expect(genreRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });
});
