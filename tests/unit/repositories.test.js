'use strict';

const RatingRepository = require('../../src/repositories/rating.repository');
const ReviewRepository = require('../../src/repositories/review.repository');
const WatchlistRepository = require('../../src/repositories/watchlist.repository');

describe('Repository error mapping and concurrent writes', () => {
  const input = { userId: 1, movieId: 2, score: 8.5 };

  test('recovers from a rating upsert insert race using the same unique key', async () => {
    const prisma = { rating: {
      upsert: jest.fn().mockRejectedValue({ code: 'P2002' }),
      update: jest.fn().mockResolvedValue({ id: 3, ...input }),
    } };
    await expect(new RatingRepository(prisma).upsert(input)).resolves.toMatchObject(input);
    expect(prisma.rating.update).toHaveBeenCalledWith({
      where: { userId_movieId: { userId: 1, movieId: 2 } }, data: { score: 8.5 },
    });
  });

  test.each(['P2003', 'P2025'])('maps rating %s to 404', async (code) => {
    const prisma = { rating: { upsert: jest.fn().mockRejectedValue({ code }) } };
    await expect(new RatingRepository(prisma).upsert(input)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('maps a concurrently duplicated watchlist insert to 409', async () => {
    const prisma = { watchlist: { create: jest.fn().mockRejectedValue({ code: 'P2002' }) } };
    await expect(new WatchlistRepository(prisma).create(input)).rejects.toMatchObject({ statusCode: 409 });
  });

  test.each([
    [ReviewRepository, 'review'], [WatchlistRepository, 'watchlist'],
  ])('maps foreign key races in %p to 404', async (Repository, model) => {
    const prisma = { [model]: { create: jest.fn().mockRejectedValue({ code: 'P2003' }) } };
    await expect(new Repository(prisma).create(input)).rejects.toMatchObject({ statusCode: 404 });
  });

  test.each([
    [RatingRepository, 'rating', 'upsert'],
    [ReviewRepository, 'review', 'create'],
    [WatchlistRepository, 'watchlist', 'create'],
  ])('preserves unexpected errors in %p', async (Repository, model, method) => {
    const failure = new Error('Database unavailable');
    const prisma = { [model]: { [method]: jest.fn().mockRejectedValue(failure) } };
    await expect(new Repository(prisma)[method](input)).rejects.toBe(failure);
  });

  test('uses database aggregation and preserves a null average', async () => {
    const prisma = { rating: { aggregate: jest.fn().mockResolvedValue({
      _avg: { score: null }, _count: { _all: 0 },
    }) } };
    await expect(new RatingRepository(prisma).getSummary(2))
      .resolves.toEqual({ averageRating: null, ratingCount: 0 });
    expect(prisma.rating.aggregate).toHaveBeenCalledWith({
      where: { movieId: 2 }, _avg: { score: true }, _count: { _all: true },
    });
  });
});
