'use strict';

class GenreRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }

    async findAll() {
        return this.prisma.genre.findMany({
            orderBy: { id: 'asc' },
        });
    }

    async findByIds(ids) {
        return this.prisma.genre.findMany({
            where: { id: { in: ids } },
        });
    }

    async findById(id) {
        return this.prisma.genre.findUnique({
            where: { id },
        });
    }
}

module.exports = GenreRepository;
