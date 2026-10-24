'use strict';

const AppError = require('../utils/app-error');

class WatchlistRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findByUserId(userId) {
    return this.prisma.watchlist.findMany({
      where: { userId },
      include: { movie: { select: { id: true, title: true, releaseYear: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async create({ userId, movieId }) {
    try {
      return await this.prisma.watchlist.create({ data: { userId, movieId } });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new AppError('Phim đã có trong Watchlist', 409);
      }
      if (err.code === 'P2003') {
        throw new AppError('Phim hoặc người dùng không còn tồn tại', 404);
      }
      throw err;
    }
  }

  async deleteForUser(userId, movieId) {
    return this.prisma.watchlist.deleteMany({ where: { userId, movieId } });
  }
}

module.exports = WatchlistRepository;
