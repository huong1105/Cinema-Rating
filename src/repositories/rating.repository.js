'use strict';

const AppError = require('../utils/app-error');

class RatingRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async upsert({ userId, movieId, score }) {
    const where = { userId_movieId: { userId, movieId } };

    try {
      try {
        return await this.prisma.rating.upsert({
          where,
          update: { score },
          create: { userId, movieId, score },
        });
      } catch (err) {
        // Some Prisma upserts can race on the initial insert. The unique
        // constraint remains authoritative; update the winning row.
        if (err.code !== 'P2002') throw err;
        return await this.prisma.rating.update({ where, data: { score } });
      }
    } catch (err) {
      if (err.code === 'P2003' || err.code === 'P2025') {
        throw new AppError('Phim hoặc người dùng không còn tồn tại', 404);
      }
      throw err;
    }
  }

  async getSummary(movieId) {
    const result = await this.prisma.rating.aggregate({
      where: { movieId },
      _avg: { score: true },
      _count: { _all: true },
    });

    return {
      averageRating: result._avg.score,
      ratingCount: result._count._all,
    };
  }

  async findByUserId(userId) {
    return this.prisma.rating.findMany({
      where: { userId },
      include: { movie: { select: { id: true, title: true, releaseYear: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}

module.exports = RatingRepository;
