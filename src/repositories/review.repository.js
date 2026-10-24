'use strict';

const AppError = require('../utils/app-error');

class ReviewRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async create({ content, userId, movieId }) {
    try {
      return await this.prisma.review.create({
        data: { content, userId, movieId },
        include: { user: { select: { id: true, username: true } } },
      });
    } catch (err) {
      if (err.code === 'P2003') {
        throw new AppError('Phim hoặc người dùng không còn tồn tại', 404);
      }
      throw err;
    }
  }

  async findByMovieId(movieId) {
    return this.prisma.review.findMany({
      where: { movieId },
      include: { user: { select: { id: true, username: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findById(id) {
    return this.prisma.review.findUnique({ where: { id } });
  }

  async deleteForUser(id, userId) {
    // Keep ownership in the DELETE predicate as well as the service check.
    return this.prisma.review.deleteMany({ where: { id, userId } });
  }
}

module.exports = ReviewRepository;
