'use strict';

class MovieRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findAll() {
    return this.prisma.movie.findMany({
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findById(id) {
    return this.prisma.movie.findUnique({
      where: { id },
      include: {
        genres: {
          include: {
            genre: true,
          },
        },
      },
    });
  }

  async create({ title, overview, director, releaseYear, genreIds = [] }) {
    return this.prisma.movie.create({
      data: {
        title,
        overview,
        director,
        releaseYear,
        genres: {
          create: genreIds.map((genreId) => ({
            genre: {
              connect: { id: genreId },
            },
          })),
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
  }

  async delete(id) {
    return this.prisma.movie.delete({
      where: { id },
    });
  }
}

module.exports = MovieRepository;
