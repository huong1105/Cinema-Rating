'use strict';

const RatingRepository = require('../../src/repositories/rating.repository');
const ReviewRepository = require('../../src/repositories/review.repository');
const WatchlistRepository = require('../../src/repositories/watchlist.repository');
const MovieRepository = require('../../src/repositories/movie.repository');
const GenreRepository = require('../../src/repositories/genre.repository');

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

  test('MovieRepository deletes a movie by id', async () => {
    const prisma = { movie: { delete: jest.fn().mockResolvedValue({ id: 1 }) } };
    const repo = new MovieRepository(prisma);
    await expect(repo.delete(1)).resolves.toEqual({ id: 1 });
    expect(prisma.movie.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  test('MovieRepository creates movie with genre relations and includes them', async () => {
    const created = { id: 10, title: 'Tenet', genres: [] };
    const prisma = { movie: { create: jest.fn().mockResolvedValue(created) } };
    const repo = new MovieRepository(prisma);
    await expect(repo.create({ title: 'Tenet', genreIds: [1, 2] })).resolves.toEqual(created);
    expect(prisma.movie.create).toHaveBeenCalledWith({
      data: {
        title: 'Tenet',
        overview: undefined,
        director: undefined,
        releaseYear: undefined,
        genres: {
          create: [
            { genre: { connect: { id: 1 } } },
            { genre: { connect: { id: 2 } } },
          ],
        },
      },
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
    });
  });

  test('GenreRepository finds genres by ids and lists all', async () => {
    const genres = [{ id: 1, name: 'Action' }, { id: 2, name: 'Drama' }];
    const prisma = {
      genre: {
        findMany: jest.fn().mockResolvedValue(genres),
        findUnique: jest.fn().mockResolvedValue(genres[0]),
      },
    };
    const repo = new GenreRepository(prisma);
    await expect(repo.findAll()).resolves.toEqual(genres);
    expect(prisma.genre.findMany).toHaveBeenCalledWith({ orderBy: { id: 'asc' } });

    await expect(repo.findByIds([1, 2])).resolves.toEqual(genres);
    expect(prisma.genre.findMany).toHaveBeenCalledWith({ where: { id: { in: [1, 2] } } });

    await expect(repo.findById(1)).resolves.toEqual(genres[0]);
    expect(prisma.genre.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});

