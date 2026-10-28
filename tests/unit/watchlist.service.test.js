'use strict';

const AppError = require('../../src/utils/app-error');
const WatchlistService = require('../../src/services/watchlist.service');

describe('WatchlistService', () => {
  let service;
  let watchlistRepository;
  let movieRepository;

  beforeEach(() => {
    watchlistRepository = {
      findByUserId: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(async (data) => ({ id: 1, ...data })),
      deleteForUser: jest.fn().mockResolvedValue({ count: 1 }),
    };
    movieRepository = { findById: jest.fn().mockResolvedValue({ id: 2 }) };
    service = new WatchlistService({ watchlistRepository, movieRepository });
  });

  test('adds an existing movie to the authenticated user watchlist', async () => {
    await expect(service.addMovie({ movieId: 2, userId: 3 }))
      .resolves.toMatchObject({ movieId: 2, userId: 3 });
    expect(movieRepository.findById).toHaveBeenCalledWith(2);
  });

  test.each([undefined, null, '2', '1e2', 0, -1, 1.5, Infinity, true, {}, 2147483648])(
    'rejects invalid JSON movieId %p', async (movieId) => {
      await expect(service.addMovie({ movieId, userId: 3 }))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(watchlistRepository.create).not.toHaveBeenCalled();
    }
  );

  test('returns 404 for a missing movie', async () => {
    movieRepository.findById.mockResolvedValue(null);
    await expect(service.addMovie({ movieId: 2, userId: 3 }))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('maps repository duplicate race P2002 to 409', async () => {
    watchlistRepository.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.addMovie({ movieId: 2, userId: 3 }))
      .rejects.toMatchObject({ statusCode: 409, message: 'Phim đã có trong Watchlist' });
  });

  test('maps repository foreign key race P2003 to 404', async () => {
    watchlistRepository.create.mockRejectedValue({ code: 'P2003' });
    await expect(service.addMovie({ movieId: 2, userId: 3 }))
      .rejects.toMatchObject({ statusCode: 404, message: 'Phim hoặc người dùng không còn tồn tại' });
  });

  test('preserves a duplicate conflict reported by the repository', async () => {
    watchlistRepository.create.mockRejectedValue(new AppError('Duplicate', 409));
    await expect(service.addMovie({ movieId: 2, userId: 3 }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('only reads the authenticated user watchlist', async () => {
    await expect(service.getMyWatchlist(3)).resolves.toEqual([]);
    expect(watchlistRepository.findByUserId).toHaveBeenCalledWith(3);
  });

  test('deletes using both user and movie IDs', async () => {
    await expect(service.removeMovie('2', 3)).resolves.toHaveProperty('message');
    expect(watchlistRepository.deleteForUser).toHaveBeenCalledWith(3, 2);
  });

  test('returns 404 if only another user has the movie', async () => {
    watchlistRepository.deleteForUser.mockResolvedValue({ count: 0 });
    await expect(service.removeMovie(2, 3)).rejects.toMatchObject({ statusCode: 404 });
  });

  test.each(['1e2', '0x10', '1.0', '-1', '0', 'abc'])('rejects malformed path ID %p', async (id) => {
    await expect(service.removeMovie(id, 3)).rejects.toMatchObject({ statusCode: 400 });
    expect(watchlistRepository.deleteForUser).not.toHaveBeenCalled();
  });

  test('rejects an invalid token identity', async () => {
    await expect(service.getMyWatchlist(undefined)).rejects.toMatchObject({ statusCode: 401 });
  });
});
