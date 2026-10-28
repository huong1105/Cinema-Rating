'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const jwt = require('jsonwebtoken');
const YAML = require('yamljs');

// Request logging is unrelated to API behavior and would flood load-smoke output.
jest.mock('morgan', () => () => (_req, _res, next) => next());

// Only this newly created, disposable database is migrated and cleaned up.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cinerate-test-'));
process.env.DATABASE_URL = `file:${path.join(directory, 'test.db').replace(/\\/g, '/')}`;
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.NODE_ENV = 'production';

const app = require('../../src/app');
const { prisma } = require('../../src/container');

let server;
let baseUrl;
let first;
let second;
let movie;
let otherMovie;
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

  async function account(username) {
    const password = crypto.randomBytes(16).toString('hex');
    const registration = await request('POST', '/api/auth/register', {
      username, password, email: `${username}@example.com`,
    });
    expect(registration.status).toBe(201);
    const login = await request('POST', '/api/auth/login', { username, password });
    expect(login.status).toBe(200);
    return { ...login.body.data.user, token: login.body.data.token, password };
  }

  first = await account('integration-first');
  second = await account('integration-second');
  movie = await prisma.movie.create({ data: { title: 'Integration Movie', releaseYear: 2020 } });
  otherMovie = await prisma.movie.create({ data: { title: 'Second Movie', releaseYear: 2021 } });
}, 60000);

beforeEach(async () => {
  await prisma.rating.deleteMany();
  await prisma.review.deleteMany();
  await prisma.watchlist.deleteMany();
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
  if (log) log.mockRestore();
});

describe('HTTP authentication', () => {
  const protectedRoutes = [
    ['POST', '/api/movies/1/ratings', { score: 8 }],
    ['GET', '/api/ratings/me', undefined],
    ['POST', '/api/movies/1/reviews', { content: 'great movie' }],
    ['DELETE', '/api/reviews/1', undefined],
    ['GET', '/api/watchlist', undefined],
    ['POST', '/api/watchlist', { movieId: 1 }],
    ['DELETE', '/api/watchlist/1', undefined],
  ];

  test.each(protectedRoutes)('%s %s requires a valid JWT', async (method, route, body) => {
    expect((await request(method, route, body)).status).toBe(401);
    expect((await request(method, route, body, 'invalid-token')).status).toBe(401);
  });

  test('rejects expired tokens and tokens without a valid user identity', async () => {
    const expired = jwt.sign({ id: first.id }, process.env.JWT_SECRET, { expiresIn: -1 });
    expect((await request('GET', '/api/ratings/me', undefined, expired)).status).toBe(401);
    const missingId = jwt.sign({ username: 'missing-id' }, process.env.JWT_SECRET);
    expect((await request('GET', '/api/watchlist', undefined, missingId)).status).toBe(401);
  });
});

describe('Rating HTTP API with SQLite', () => {
  test('rates again without creating another row and ignores client userId', async () => {
    const route = `/api/movies/${movie.id}/ratings`;
    const created = await request('POST', route, { score: 8.5, userId: second.id }, first.token);
    expect(created.status).toBe(200);
    expect(created.body.data).toMatchObject({ userId: first.id, movieId: movie.id, score: 8.5 });
    const updated = await request('POST', route, { score: 9 }, first.token);
    expect(updated.status).toBe(200);
    expect(updated.body.data.id).toBe(created.body.data.id);
    expect(updated.body.data.score).toBe(9);
    expect(await prisma.rating.count()).toBe(1);
  });

  test('concurrent ratings retain one unique user/movie row', async () => {
    const responses = await Promise.all([7, 8, 9, 10].map((score) => request(
      'POST', `/api/movies/${movie.id}/ratings`, { score }, first.token
    )));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    expect(await prisma.rating.count({ where: { userId: first.id, movieId: movie.id } })).toBe(1);
  });

  test('returns a public null summary and aggregates all users', async () => {
    const route = `/api/movies/${movie.id}/ratings/summary`;
    expect(await request('GET', route)).toEqual({
      status: 200, body: { data: { averageRating: null, ratingCount: 0 } },
    });
    await request('POST', `/api/movies/${movie.id}/ratings`, { score: 7 }, first.token);
    await request('POST', `/api/movies/${movie.id}/ratings`, { score: 9 }, second.token);
    expect((await request('GET', route)).body.data).toEqual({ averageRating: 8, ratingCount: 2 });
  });

  test('returns only current user history in stable newest-first order', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const older = await prisma.rating.create({ data: { userId: first.id, movieId: movie.id, score: 7, createdAt } });
    const newer = await prisma.rating.create({ data: { userId: first.id, movieId: otherMovie.id, score: 8, createdAt } });
    await prisma.rating.create({ data: { userId: second.id, movieId: movie.id, score: 10 } });
    const response = await request('GET', '/api/ratings/me', undefined, first.token);
    expect(response.status).toBe(200);
    expect(response.body.data.map((rating) => rating.id)).toEqual([newer.id, older.id]);
    expect(response.body.data[0].movie).toEqual({ id: otherMovie.id, title: 'Second Movie', releaseYear: 2021 });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|email/);
  });

  test.each([null, '8', -1, 11, true, {}])('rejects invalid JSON score %p', async (score) => {
    expect((await request('POST', `/api/movies/${movie.id}/ratings`, { score }, first.token)).status).toBe(400);
  });

  test('rejects a missing score and a nonexistent movie', async () => {
    expect((await request('POST', `/api/movies/${movie.id}/ratings`, {}, first.token)).status).toBe(400);
    expect((await request('POST', '/api/movies/2147483647/ratings', { score: 8 }, first.token)).status).toBe(404);
    expect((await request('GET', '/api/movies/2147483647/ratings/summary')).status).toBe(404);
  });
});

describe('Review HTTP API with SQLite', () => {
  test('allows repeated reviews, returns public authors safely and orders ties by ID', async () => {
    const route = `/api/movies/${movie.id}/reviews`;
    expect((await request('GET', route)).body.data).toEqual([]);
    const firstReview = await request('POST', route, { content: '  great movie  ', userId: second.id }, first.token);
    const secondReview = await request('POST', route, { content: 'great movie' }, first.token);
    expect(firstReview.status).toBe(201);
    expect(secondReview.status).toBe(201);
    expect(firstReview.body.data).toMatchObject({ content: 'great movie', userId: first.id });
    await prisma.review.updateMany({ data: { createdAt: new Date('2026-01-01T00:00:00Z') } });
    const response = await request('GET', route);
    expect(response.status).toBe(200);
    expect(response.body.data.map((review) => review.id)).toEqual([secondReview.body.data.id, firstReview.body.data.id]);
    expect(response.body.data[0].user).toEqual({ id: first.id, username: first.username });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|email/);
  });

  test('only the author can delete a review', async () => {
    const review = await prisma.review.create({ data: { userId: first.id, movieId: movie.id, content: 'Great movie' } });
    const route = `/api/reviews/${review.id}`;
    expect((await request('DELETE', route, undefined, second.token)).status).toBe(403);
    expect(await prisma.review.findUnique({ where: { id: review.id } })).not.toBeNull();
    expect((await request('DELETE', route, undefined, first.token)).status).toBe(200);
    expect((await request('DELETE', route, undefined, first.token)).status).toBe(404);
  });

  test.each([undefined, null, 12345, '1234', '    '])('rejects invalid content %p', async (content) => {
    expect((await request('POST', `/api/movies/${movie.id}/reviews`, { content }, first.token)).status).toBe(400);
  });

  test('checks movie existence for public and protected review requests', async () => {
    expect((await request('GET', '/api/movies/2147483647/reviews')).status).toBe(404);
    expect((await request('POST', '/api/movies/2147483647/reviews', { content: 'Great movie' }, first.token)).status).toBe(404);
  });
});

describe('Watchlist HTTP API with SQLite', () => {
  test('creates a scoped item, rejects duplicates and prevents deletion by another user', async () => {
    const response = await request('POST', '/api/watchlist', { movieId: movie.id, userId: second.id }, first.token);
    expect(response.status).toBe(201);
    expect(response.body.data.userId).toBe(first.id);
    expect((await request('POST', '/api/watchlist', { movieId: movie.id }, first.token)).status).toBe(409);
    expect((await request('GET', '/api/watchlist', undefined, second.token)).body.data).toEqual([]);
    expect((await request('DELETE', `/api/watchlist/${movie.id}`, undefined, second.token)).status).toBe(404);
    const ownerList = await request('GET', '/api/watchlist', undefined, first.token);
    expect(ownerList.body.data).toHaveLength(1);
    expect(ownerList.body.data[0].movie).toEqual({ id: movie.id, title: 'Integration Movie', releaseYear: 2020 });
    expect((await request('DELETE', `/api/watchlist/${movie.id}`, undefined, first.token)).status).toBe(200);
    expect((await request('DELETE', `/api/watchlist/${movie.id}`, undefined, first.token)).status).toBe(404);
  });

  test('concurrent duplicate requests produce one 201 and the rest 409', async () => {
    const responses = await Promise.all([1, 2, 3, 4].map(() => request(
      'POST', '/api/watchlist', { movieId: movie.id }, first.token
    )));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409, 409, 409]);
    expect(await prisma.watchlist.count()).toBe(1);
  });

  test('uses a stable order for watchlist items with equal timestamps', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const older = await prisma.watchlist.create({ data: { userId: first.id, movieId: movie.id, createdAt } });
    const newer = await prisma.watchlist.create({ data: { userId: first.id, movieId: otherMovie.id, createdAt } });
    const response = await request('GET', '/api/watchlist', undefined, first.token);
    expect(response.body.data.map((item) => item.id)).toEqual([newer.id, older.id]);
  });

  test.each([undefined, null, '1', 0, -1, 1.5, true])('rejects invalid JSON movieId %p', async (movieId) => {
    expect((await request('POST', '/api/watchlist', { movieId }, first.token)).status).toBe(400);
  });

  test('returns 404 when a movie does not exist', async () => {
    expect((await request('POST', '/api/watchlist', { movieId: 2147483647 }, first.token)).status).toBe(404);
  });
});

describe('C routes coexist with A/B and Swagger', () => {
  test.each(['1e2', '0x10', '1.0', '01', '-1', '2147483648'])('rejects malformed path ID %s', async (id) => {
    const responses = await Promise.all([
      request('GET', `/api/movies/${id}/reviews`),
      request('GET', `/api/movies/${id}/ratings/summary`),
      request('POST', `/api/movies/${id}/ratings`, { score: 8 }, first.token),
      request('POST', `/api/movies/${id}/reviews`, { content: 'great' }, first.token),
      request('DELETE', `/api/reviews/${id}`, undefined, first.token),
      request('DELETE', `/api/watchlist/${id}`, undefined, first.token),
    ]);
    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400, 400, 400]);
  });

  test('existing Auth, Movie, Genre and health APIs still work', async () => {
    expect((await request('GET', '/health')).status).toBe(200);
    expect((await request('GET', '/api/movies')).status).toBe(200);
    expect((await request('GET', `/api/movies/${movie.id}`)).body.data.id).toBe(movie.id);
    expect((await request('GET', '/api/genres')).status).toBe(200);
    expect((await request('GET', '/api/auth/profile', undefined, first.token)).body.data.id).toBe(first.id);
    const profile = await request('PUT', '/api/auth/profile', { email: 'changed@example.com' }, first.token);
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe('changed@example.com');
    const created = await request('POST', '/api/movies', { title: 'Temporary B movie' }, first.token);
    expect(created.status).toBe(201);
    expect((await request('DELETE', `/api/movies/${created.body.data.id}`, undefined, first.token)).status).toBe(200);
    expect((await request('POST', '/api/movies', { title: 'Requires auth' })).status).toBe(401);
    expect((await request('GET', '/api/not-a-route')).status).toBe(404);
  });

  test('Swagger documents the C operations and all local references resolve', async () => {
    const document = YAML.load(path.join(__dirname, '../../docs/swagger.yaml'));
    const operations = [
      ['/api/movies/{id}/ratings', 'post', '200'],
      ['/api/movies/{id}/ratings/summary', 'get', '200'],
      ['/api/ratings/me', 'get', '200'],
      ['/api/movies/{id}/reviews', 'get', '200'],
      ['/api/movies/{id}/reviews', 'post', '201'],
      ['/api/reviews/{id}', 'delete', '200'],
      ['/api/watchlist', 'get', '200'],
      ['/api/watchlist', 'post', '201'],
      ['/api/watchlist/{movieId}', 'delete', '200'],
    ];
    for (const [route, method, status] of operations) {
      expect(document.paths[route][method].responses[status].content['application/json'].schema).toBeDefined();
    }
    function checkReferences(value) {
      if (!value || typeof value !== 'object') return;
      if (value.$ref) {
        expect(value.$ref.startsWith('#/')).toBe(true);
        const target = value.$ref.slice(2).split('/').reduce((current, key) => current?.[key], document);
        expect(target).toBeDefined();
      }
      Object.values(value).forEach(checkReferences);
    }
    checkReferences(document);
    const response = await fetch(`${baseUrl}/api-docs/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('swagger-ui');
  });
});

describe('Load test safeguards and local smoke', () => {
  const { createScenarios, preflight, runScenario } = require('../kaggle/load-test');

  function scenarios(password = first.password) {
    return createScenarios({
      BASE_URL: baseUrl,
      LOAD_TEST_USERNAME: first.username,
      LOAD_TEST_PASSWORD: password,
      LOAD_TEST_MOVIE_ID: String(movie.id),
      LOAD_TEST_DURATION: '1',
      LOAD_TEST_INCLUDE_C: '1',
    });
  }

  test('stops preflight when login returns 401', async () => {
    await expect(preflight(scenarios(crypto.randomBytes(16).toString('hex'))))
      .rejects.toThrow('HTTP 401');
  });

  test('preflights all seven scenarios and smoke-runs the three original baselines', async () => {
    const cases = scenarios();
    await expect(preflight(cases)).resolves.toBeUndefined();
    const output = jest.spyOn(console, 'log').mockImplementation(() => { });
    try {
      for (const scenario of cases.slice(0, 3)) {
        const summary = await runScenario(scenario);
        expect(summary.completedHttpRequests).toBeGreaterThan(0);
        expect(summary.failedRequests).toBe(0);
        expect(summary.latencyP95Ms).toEqual(expect.any(Number));
        expect(summary.latencyP99Ms).toEqual(expect.any(Number));
      }
    } finally {
      output.mockRestore();
    }
  }, 20000);
});
