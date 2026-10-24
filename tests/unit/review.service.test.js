'use strict';

const ReviewService = require('../../src/services/review.service');

describe('ReviewService', () => {
  let service;
  let reviewRepository;
  let movieRepository;

  beforeEach(() => {
    reviewRepository = {
      create: jest.fn().mockImplementation(async (data) => ({ id: 1, ...data })),
      findByMovieId: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue({ id: 1, userId: 3 }),
      deleteForUser: jest.fn().mockResolvedValue({ count: 1 }),
    };
    movieRepository = { findById: jest.fn().mockResolvedValue({ id: 2 }) };
    service = new ReviewService({ reviewRepository, movieRepository });
  });

  test('trims content and accepts five characters', async () => {
    await expect(service.addReview({ movieId: '2', userId: 3, content: '  great  ' }))
      .resolves.toMatchObject({ movieId: 2, userId: 3, content: 'great' });
  });

  test.each([undefined, null, '', '    ', '1234', ' 1234 ', 12345, true, {}, []])(
    'rejects invalid content %p', async (content) => {
      await expect(service.addReview({ movieId: 2, userId: 3, content }))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(reviewRepository.create).not.toHaveBeenCalled();
    }
  );

  test('checks movie existence on both reads and writes', async () => {
    movieRepository.findById.mockResolvedValue(null);
    await expect(service.addReview({ movieId: 2, userId: 3, content: 'great' }))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(service.getMovieReviews(2)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('returns an empty list for a movie with no reviews', async () => {
    await expect(service.getMovieReviews('2')).resolves.toEqual([]);
    expect(reviewRepository.findByMovieId).toHaveBeenCalledWith(2);
  });

  test('allows more than one review per user and movie', async () => {
    const input = { movieId: 2, userId: 3, content: 'great' };
    await service.addReview(input);
    await service.addReview(input);
    expect(reviewRepository.create).toHaveBeenCalledTimes(2);
  });

  test('deletes an owned review with an ownership predicate', async () => {
    await expect(service.deleteReview('1', 3)).resolves.toHaveProperty('message');
    expect(reviewRepository.deleteForUser).toHaveBeenCalledWith(1, 3);
  });

  test('returns 403 when another user tries to delete a review', async () => {
    await expect(service.deleteReview(1, 4)).rejects.toMatchObject({ statusCode: 403 });
    expect(reviewRepository.deleteForUser).not.toHaveBeenCalled();
  });

  test('returns 404 when a review is missing', async () => {
    reviewRepository.findById.mockResolvedValue(null);
    await expect(service.deleteReview(1, 3)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('returns 404 when a review disappears between lookup and deletion', async () => {
    reviewRepository.deleteForUser.mockResolvedValue({ count: 0 });
    await expect(service.deleteReview(1, 3)).rejects.toMatchObject({ statusCode: 404 });
  });

  test.each(['1e2', '1.0', '-1', '0', 'abc', 2147483648])(
    'rejects malformed IDs %p', async (id) => {
      await expect(service.getMovieReviews(id)).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.deleteReview(id, 3)).rejects.toMatchObject({ statusCode: 400 });
    }
  );
});
