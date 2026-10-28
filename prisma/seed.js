'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
  'Drama', 'Fantasy', 'Horror', 'Romance', 'Science Fiction', 'Thriller'
];

async function main() {
  console.log('Seeding database...');

  for (const name of GENRES) {
    await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`  ✔ ${GENRES.length} thể loại (Genres)`);

  const passwordHash = await bcrypt.hash('123456', 10);
  const user = await prisma.user.upsert({
    where: { username: 'testuser' },
    update: {},
    create: {
      email: 'test@example.com',
      username: 'testuser',
      passwordHash,
    },
  });
  console.log('  ✔ User mẫu: testuser / 123456');

  const action = await prisma.genre.findUnique({ where: { name: 'Action' } });
  const scifi = await prisma.genre.findUnique({ where: { name: 'Science Fiction' } });
  const adventure = await prisma.genre.findUnique({ where: { name: 'Adventure' } });
  const drama = await prisma.genre.findUnique({ where: { name: 'Drama' } });
  const crime = await prisma.genre.findUnique({ where: { name: 'Crime' } });
  const animation = await prisma.genre.findUnique({ where: { name: 'Animation' } });
  const fantasy = await prisma.genre.findUnique({ where: { name: 'Fantasy' } });
  const thriller = await prisma.genre.findUnique({ where: { name: 'Thriller' } });
  const comedy = await prisma.genre.findUnique({ where: { name: 'Comedy' } });

  const movie1 = await prisma.movie.upsert({
    where: { id: 1 },
    update: {},
    create: {
      title: 'Inception',
      overview: 'A thief who steals corporate secrets through dream-sharing technology.',
      director: 'Christopher Nolan',
      releaseYear: 2010,
      genres: {
        create: [
          { genre: { connect: { id: action.id } } },
          { genre: { connect: { id: scifi.id } } },
        ],
      },
    },
  });

  const movie2 = await prisma.movie.upsert({
    where: { id: 2 },
    update: {},
    create: {
      title: 'Interstellar',
      overview: 'Explorers travel through a wormhole in space to ensure humanity\'s survival.',
      director: 'Christopher Nolan',
      releaseYear: 2014,
      genres: {
        create: [
          { genre: { connect: { id: scifi.id } } },
        ],
      },
    },
  });

  const movie3 = await prisma.movie.upsert({
    where: { id: 3 },
    update: {},
    create: {
      title: 'The Dark Knight',
      overview: 'When the menace known as the Joker wreaks havoc on Gotham, Batman must face his greatest psychological and physical test.',
      director: 'Christopher Nolan',
      releaseYear: 2008,
      genres: {
        create: [
          { genre: { connect: { id: action.id } } },
          { genre: { connect: { id: crime.id } } },
          { genre: { connect: { id: drama.id } } },
        ],
      },
    },
  });

  const movie4 = await prisma.movie.upsert({
    where: { id: 4 },
    update: {},
    create: {
      title: 'Spirited Away',
      overview: 'A 10-year-old girl wanders into a world ruled by gods, witches, and spirits, and must find a way to free her parents.',
      director: 'Hayao Miyazaki',
      releaseYear: 2001,
      genres: {
        create: [
          { genre: { connect: { id: animation.id } } },
          { genre: { connect: { id: adventure.id } } },
          { genre: { connect: { id: fantasy.id } } },
        ],
      },
    },
  });

  const movie5 = await prisma.movie.upsert({
    where: { id: 5 },
    update: {},
    create: {
      title: 'Parasite',
      overview: 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.',
      director: 'Bong Joon-ho',
      releaseYear: 2019,
      genres: {
        create: [
          { genre: { connect: { id: drama.id } } },
          { genre: { connect: { id: thriller.id } } },
          { genre: { connect: { id: comedy.id } } },
        ],
      },
    },
  });
  console.log('  ✔ 5 phim mẫu: Inception, Interstellar, The Dark Knight, Spirited Away, Parasite');

  await prisma.rating.upsert({
    where: { userId_movieId: { userId: user.id, movieId: movie1.id } },
    update: {},
    create: {
      score: 9.5,
      userId: user.id,
      movieId: movie1.id,
    },
  });
  console.log('  ✔ Rating mẫu (9.5/10 cho Inception)');

  const existingReview = await prisma.review.findFirst({
    where: { userId: user.id, movieId: movie1.id },
  });
  if (!existingReview) {
    await prisma.review.create({
      data: {
        content: 'Phim cực kỳ xuất sắc, kịch bản đa tầng và kỹ xảo tuyệt đỉnh!',
        userId: user.id,
        movieId: movie1.id,
      },
    });
  }
  console.log('  ✔ Review mẫu cho Inception');

  await prisma.watchlist.upsert({
    where: { userId_movieId: { userId: user.id, movieId: movie2.id } },
    update: {},
    create: {
      userId: user.id,
      movieId: movie2.id,
    },
  });
  console.log(' Watchlist mẫu (lưu phim Interstellar)');

  console.log('\n Seed hoàn tất!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
