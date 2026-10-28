'use strict';

const RatingService = require('../../src/services/rating.service');

describe('RatingService', () => {
  let service;
  let ratingRepository;
  let movieRepository;

  beforeEach(() => {
    ratingRepository = {
      upsert: jest.fn().mockImplementation(async (data) => ({ id: 1, ...data })),
      getSummary: jest.fn().mockResolvedValue({ averageRating: null, ratingCount: 0 }),
      findByUserId: jest.fn().mockResolvedValue([]),
    };
    movieRepository = { findById: jest.fn().mockResolvedValue({ id: 2 }) };
    service = new RatingService({ ratingRepository, movieRepository });
  });

  test.each([1, 8.5, 10])('accepts score %p and resolves a path ID', async (score) => {
    await expect(service.rateMovie({ movieId: '2', userId: 3, score }))
      .resolves.toMatchObject({ movieId: 2, userId: 3, score });
    expect(movieRepository.findById).toHaveBeenCalledWith(2);
  });

  test.each([0, 10.1, -1, NaN, Infinity, -Infinity, '8.5', null, undefined, true, {}, []])(
    'rejects invalid score %p before database access', async (score) => {
      await expect(service.rateMovie({ movieId: 2, userId: 3, score }))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(movieRepository.findById).not.toHaveBeenCalled();
      expect(ratingRepository.upsert).not.toHaveBeenCalled();
    }
  );

  test.each(['1e2', '0x10', '1.0', '01', ' 1 ', '1x', '', 0, -1, 1.5, 2147483648, null])(
    'rejects malformed movie ID %p', async (movieId) => {
      await expect(service.getMovieSummary(movieId)).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.rateMovie({ movieId, userId: 3, score: 8 }))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(movieRepository.findById).not.toHaveBeenCalled();
    }
  );

  test('returns 404 for a missing movie on writes and summary reads', async () => {
    movieRepository.findById.mockResolvedValue(null);
    await expect(service.rateMovie({ movieId: 2, userId: 3, score: 8 }))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getMovieSummary(2)).rejects.toMatchObject({ statusCode: 404 });
    expect(ratingRepository.upsert).not.toHaveBeenCalled();
  });

  test.each(['P2003', 'P2025'])('maps repository database error %s to 404', async (code) => {
    ratingRepository.upsert.mockRejectedValue({ code });
    await expect(service.rateMovie({ movieId: 2, userId: 3, score: 8 }))
      .rejects.toMatchObject({ statusCode: 404, message: 'Phim hoặc người dùng không còn tồn tại' });
  });

  test('uses the same user/movie key when a user rates again', async () => {
    await service.rateMovie({ movieId: 2, userId: 3, score: 8 });
    await service.rateMovie({ movieId: 2, userId: 3, score: 9 });
    expect(ratingRepository.upsert.mock.calls).toEqual([
      [{ movieId: 2, userId: 3, score: 8 }],
      [{ movieId: 2, userId: 3, score: 9 }],
    ]);
  });

  test('returns null average when a movie has no ratings', async () => {
    await expect(service.getMovieSummary(2))
      .resolves.toEqual({ averageRating: null, ratingCount: 0 });
  });

  test('scopes rating history to the authenticated user', async () => {
    await expect(service.getMyRatings(3)).resolves.toEqual([]);
    expect(ratingRepository.findByUserId).toHaveBeenCalledWith(3);
  });

  test.each([undefined, '3', 0, -1])('rejects invalid token user ID %p', async (userId) => {
    await expect(service.getMyRatings(userId)).rejects.toMatchObject({ statusCode: 401 });
    expect(ratingRepository.findByUserId).not.toHaveBeenCalled();
  });
});
