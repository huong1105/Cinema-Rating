'use strict';

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
    return this.prisma.watchlist.create({ data: { userId, movieId } });
  }

  async deleteForUser(userId, movieId) {
    return this.prisma.watchlist.deleteMany({ where: { userId, movieId } });
  }
}

module.exports = WatchlistRepository;
