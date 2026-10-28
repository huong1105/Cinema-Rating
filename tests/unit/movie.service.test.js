'use strict';

const MovieService = require('../../src/services/movie.service');

describe('MovieService', () => {
  let service;
  let movieRepository;
  let genreRepository;

  beforeEach(() => {
    movieRepository = {
      findAll: jest.fn().mockResolvedValue([
        { id: 1, title: 'Inception', releaseYear: 2010, genres: [] },
      ]),
      findById: jest.fn().mockImplementation(async (id) => {
        if (id === 1) return { id: 1, title: 'Inception', releaseYear: 2010, genres: [] };
        return null;
      }),
      create: jest.fn().mockImplementation(async (data) => ({
        id: 99,
        ...data,
      })),
      delete: jest.fn().mockResolvedValue({ id: 1 }),
    };
    genreRepository = {
      findByIds: jest.fn().mockImplementation(async (ids) => {
        const valid = [{ id: 1, name: 'Action' }, { id: 2, name: 'Sci-Fi' }];
        return valid.filter((g) => ids.includes(g.id));
      }),
    };
    service = new MovieService({ movieRepository, genreRepository });
  });

  describe('getAllMovies', () => {
    test('resolves all movies from repository', async () => {
      const result = await service.getAllMovies();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Inception');
      expect(movieRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMovieById', () => {
    test('resolves movie by valid numeric id', async () => {
      const result = await service.getMovieById(1);
      expect(result).toMatchObject({ id: 1, title: 'Inception' });
      expect(movieRepository.findById).toHaveBeenCalledWith(1);
    });

    test('accepts string representation of safe integer', async () => {
      const result = await service.getMovieById('1');
      expect(result).toMatchObject({ id: 1, title: 'Inception' });
      expect(movieRepository.findById).toHaveBeenCalledWith(1);
    });

    test.each(['1e2', '0x10', '1.0', '01', ' 1 ', '', 0, -1, 1.5, 2147483648, null, undefined])(
      'rejects invalid movie id %p with 400',
      async (invalidId) => {
        await expect(service.getMovieById(invalidId)).rejects.toMatchObject({ statusCode: 400 });
        expect(movieRepository.findById).not.toHaveBeenCalled();
      }
    );

    test('rejects with 404 when movie is not found', async () => {
      await expect(service.getMovieById(999)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy phim',
      });
      expect(movieRepository.findById).toHaveBeenCalledWith(999);
    });
  });

  describe('createMovie', () => {
    test('creates movie with valid minimal input', async () => {
      const result = await service.createMovie({ title: 'Interstellar' });
      expect(result).toMatchObject({ title: 'Interstellar', genreIds: [] });
      expect(movieRepository.create).toHaveBeenCalledWith({
        title: 'Interstellar',
        overview: undefined,
        director: undefined,
        releaseYear: undefined,
        genreIds: [],
      });
    });

    test('creates movie with all valid fields and verified genreIds', async () => {
      const data = {
        title: ' The Matrix ',
        overview: 'A computer hacker learns the truth...',
        director: 'Wachowskis',
        releaseYear: 1999,
        genreIds: [1, 2],
      };
      const result = await service.createMovie(data);
      expect(result).toMatchObject({
        title: 'The Matrix',
        overview: data.overview,
        director: data.director,
        releaseYear: 1999,
        genreIds: [1, 2],
      });
      expect(genreRepository.findByIds).toHaveBeenCalledWith([1, 2]);
      expect(movieRepository.create).toHaveBeenCalledWith({
        title: 'The Matrix',
        overview: data.overview,
        director: data.director,
        releaseYear: 1999,
        genreIds: [1, 2],
      });
    });

    test('deduplicates genreIds before verifying', async () => {
      await service.createMovie({
        title: 'The Matrix',
        genreIds: [1, 2, 1, 2],
      });
      expect(genreRepository.findByIds).toHaveBeenCalledWith([1, 2]);
    });

    test.each(['', '   ', null, undefined, 123, {}, []])(
      'rejects invalid title %p with 400',
      async (title) => {
        await expect(service.createMovie({ title })).rejects.toMatchObject({
          statusCode: 400,
          message: 'Tên phim không được để trống',
        });
        expect(movieRepository.create).not.toHaveBeenCalled();
      }
    );

    test('rejects missing or empty data object with 400', async () => {
      await expect(service.createMovie()).rejects.toMatchObject({
        statusCode: 400,
        message: 'Tên phim không được để trống',
      });
      await expect(service.createMovie(null)).rejects.toMatchObject({
        statusCode: 400,
        message: 'Tên phim không được để trống',
      });
    });

    test.each(['not-an-array', 123, null, {}])(
      'rejects non-array genreIds %p with 400',
      async (genreIds) => {
        await expect(service.createMovie({ title: 'Film', genreIds })).rejects.toMatchObject({
          statusCode: 400,
          message: 'genreIds phải là một mảng',
        });
      }
    );

    test.each([
      [[-1]],
      [[0]],
      [['1']],
      [[1.5]],
      [[null]],
    ])('rejects invalid genreIds array elements %p with 400', async (genreIds) => {
      await expect(service.createMovie({ title: 'Film', genreIds })).rejects.toMatchObject({
        statusCode: 400,
        message: 'ID thể loại không hợp lệ',
      });
    });

    test('rejects non-existent genreIds with 400', async () => {
      await expect(service.createMovie({ title: 'Film', genreIds: [1, 999] })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Có thể loại không tồn tại',
      });
      expect(movieRepository.create).not.toHaveBeenCalled();
    });

    test.each([
      1887,
      new Date().getFullYear() + 11,
      1999.5,
      '2020',
      -2000,
    ])('rejects invalid releaseYear %p with 400', async (releaseYear) => {
      await expect(service.createMovie({ title: 'Film', releaseYear })).rejects.toMatchObject({
        statusCode: 400,
        message: 'Năm phát hành không hợp lệ',
      });
    });
  });

  describe('deleteMovie', () => {
    test('deletes existing movie successfully', async () => {
      const result = await service.deleteMovie(1);
      expect(result).toEqual({ message: 'Xóa phim thành công' });
      expect(movieRepository.delete).toHaveBeenCalledWith(1);
    });

    test.each(['1e2', '0x10', '1.0', '', -1, 0, null])(
      'rejects invalid ID %p with 400',
      async (invalidId) => {
        await expect(service.deleteMovie(invalidId)).rejects.toMatchObject({ statusCode: 400 });
        expect(movieRepository.delete).not.toHaveBeenCalled();
      }
    );

    test('rejects with 404 when movie does not exist', async () => {
      await expect(service.deleteMovie(999)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy phim',
      });
      expect(movieRepository.delete).not.toHaveBeenCalled();
    });

    test('catches P2025 error from repository delete and throws 404', async () => {
      movieRepository.delete.mockRejectedValue({ code: 'P2025' });
      await expect(service.deleteMovie(1)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Không tìm thấy phim',
      });
    });

    test('rethrows unexpected error from repository delete', async () => {
      const err = new Error('Database down');
      movieRepository.delete.mockRejectedValue(err);
      await expect(service.deleteMovie(1)).rejects.toBe(err);
    });
  });
});
