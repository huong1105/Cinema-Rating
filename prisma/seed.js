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
  console.log('  ✔ 2 phim mẫu: Inception, Interstellar');

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

  await prisma.review.create({
    data: {
      content: 'Phim cực kỳ xuất sắc, kịch bản đa tầng và kỹ xảo tuyệt đỉnh!',
      userId: user.id,
      movieId: movie1.id,
    },
  });
  console.log('  ✔ Review mẫu cho Inception');

  await prisma.watchlist.upsert({
    where: { userId_movieId: { userId: user.id, movieId: movie2.id } },
    update: {},
    create: {
      userId: user.id,
      movieId: movie2.id,
    },
  });
  console.log('  ✔ Watchlist mẫu (lưu phim Interstellar)');

  console.log('\n✅ Seed hoàn tất!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
