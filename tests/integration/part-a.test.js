'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

jest.mock('morgan', () => () => (_req, _res, next) => next());

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cinerate-parta-test-'));
process.env.DATABASE_URL = `file:${path.join(directory, 'test.db').replace(/\\/g, '/')}`;
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV = 'production';

const app = require('../../src/app');
const { prisma } = require('../../src/container');

let server;
let baseUrl;
let userToken;
let actionGenre;
let dramaGenre;
let log;

async function request(method, route, body, token) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

beforeAll(async () => {
  log = jest.spyOn(console, 'error').mockImplementation(() => { });
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: path.join(__dirname, '../..'), env: { ...process.env, RUST_LOG: process.env.RUST_LOG || 'info', }, stdio: 'pipe', timeout: 30000,
  });
  await prisma.$connect();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  actionGenre = await prisma.genre.create({ data: { name: 'Action' } });
  dramaGenre = await prisma.genre.create({ data: { name: 'Drama' } });

  const username = 'movie-tester';
  const password = 'password123';
  await request('POST', '/api/auth/register', {
    username, password, email: `${username}@example.com`,
  });
  const loginRes = await request('POST', '/api/auth/login', { username, password });
  userToken = loginRes.body.data.token;
}, 60000);

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
  if (log) log.mockRestore();
});

describe('Part A: Movies & Genres API Endpoints', () => {
  describe('GET /api/genres', () => {
    test('returns list of all genres in system', async () => {
      const res = await request('GET', '/api/genres');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.some((g) => g.name === 'Action')).toBe(true);
    });
  });

  describe('POST /api/movies', () => {
    test('rejects request without Bearer token with 401', async () => {
      const res = await request('POST', '/api/movies', { title: 'Test' });
      expect(res.status).toBe(401);
    });

    test('rejects creation without a valid title with 400', async () => {
      const res = await request('POST', '/api/movies', { title: '' }, userToken);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Tên phim không được để trống');
    });

    test('rejects creation with invalid releaseYear with 400', async () => {
      const res = await request('POST', '/api/movies', { title: 'Film', releaseYear: 1800 }, userToken);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Năm phát hành không hợp lệ');
    });

    test('rejects creation with non-existent genreIds with 400', async () => {
      const res = await request('POST', '/api/movies', { title: 'Film', genreIds: [9999] }, userToken);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Có thể loại không tồn tại');
    });

    test('creates movie successfully with valid data and genres', async () => {
      const payload = {
        title: 'The Dark Knight',
        overview: 'Batman fights the Joker in Gotham City.',
        director: 'Christopher Nolan',
        releaseYear: 2008,
        genreIds: [actionGenre.id, dramaGenre.id],
      };
      const res = await request('POST', '/api/movies', payload, userToken);
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Tạo phim thành công');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(payload.title);
      expect(res.body.data.genres).toHaveLength(2);
    });
  });

  describe('GET /api/movies', () => {
    test('returns list of movies with genres', async () => {
      const res = await request('GET', '/api/movies');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.find((m) => m.title === 'The Dark Knight');
      expect(found).toBeDefined();
      expect(found.genres).toHaveLength(2);
      expect(found.genres[0].genre.name).toBeDefined();
    });
  });

  describe('GET /api/movies/:id', () => {
    test('returns movie details by ID', async () => {
      const listRes = await request('GET', '/api/movies');
      const movie = listRes.body.data[0];

      const res = await request('GET', `/api/movies/${movie.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(movie.id);
      expect(res.body.data.title).toBe(movie.title);
    });

    test('returns 400 for malformed ID', async () => {
      const res = await request('GET', '/api/movies/not-a-number');
      expect(res.status).toBe(400);
    });

    test('returns 404 for non-existent movie ID', async () => {
      const res = await request('GET', '/api/movies/999999');
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Không tìm thấy phim');
    });
  });

  describe('DELETE /api/movies/:id', () => {
    test('rejects delete without Bearer token with 401', async () => {
      const res = await request('DELETE', '/api/movies/1');
      expect(res.status).toBe(401);
    });

    test('returns 404 when deleting non-existent movie', async () => {
      const res = await request('DELETE', '/api/movies/999999', undefined, userToken);
      expect(res.status).toBe(404);
    });

    test('deletes existing movie successfully', async () => {
      const createRes = await request('POST', '/api/movies', { title: 'Movie To Delete' }, userToken);
      const movieId = createRes.body.data.id;

      const deleteRes = await request('DELETE', `/api/movies/${movieId}`, undefined, userToken);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toBe('Xóa phim thành công');

      const getRes = await request('GET', `/api/movies/${movieId}`);
      expect(getRes.status).toBe(404);
    });
  });
});
