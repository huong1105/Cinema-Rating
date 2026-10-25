'use strict';

const autocannon = require('autocannon');
const os = require('os');
const { performance } = require('perf_hooks');
const LATENCY_SAMPLE_LIMIT = 100000;

function createScenarios(env = process.env) {
  if (!env.LOAD_TEST_USERNAME || !env.LOAD_TEST_PASSWORD) {
    throw new Error('Set LOAD_TEST_USERNAME and LOAD_TEST_PASSWORD to a valid test account.');
  }
  const baseUrl = new URL(env.BASE_URL || 'http://localhost:3000');
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new Error('BASE_URL must be an HTTP(S) URL without embedded credentials.');
  }
  const durationText = env.LOAD_TEST_DURATION || '10';
  const movieId = env.LOAD_TEST_MOVIE_ID || '1';
  if (!/^[1-9]\d*$/.test(durationText) || Number(durationText) > 3600) {
    throw new Error('LOAD_TEST_DURATION must be an integer from 1 to 3600 seconds.');
  }
  if (!/^[1-9]\d*$/.test(movieId) || Number(movieId) > 2147483647) {
    throw new Error('LOAD_TEST_MOVIE_ID must be a positive Prisma Int.');
  }
  const origin = baseUrl.href.replace(/\/$/, '');
  const duration = Number(durationText);
  // Preserve the three original baseline scenarios and connection counts.
  const scenarios = [
    { title: 'GET /api/movies (list)', url: `${origin}/api/movies`, method: 'GET', duration, connections: 10 },
    { title: 'GET /api/movies/:id (detail)', url: `${origin}/api/movies/${movieId}`, method: 'GET', duration, connections: 10 },
    {
      title: 'POST /api/auth/login', url: `${origin}/api/auth/login`, method: 'POST', duration, connections: 5,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: env.LOAD_TEST_USERNAME, password: env.LOAD_TEST_PASSWORD }),
    },
  ];

  if (env.LOAD_TEST_INCLUDE_C === '1') {
    scenarios.push(
      { title: 'GET movie reviews', url: `${origin}/api/movies/${movieId}/reviews`, method: 'GET', duration, connections: 10 },
      { title: 'GET rating summary', url: `${origin}/api/movies/${movieId}/ratings/summary`, method: 'GET', duration, connections: 10 },
      { title: 'GET my ratings', url: `${origin}/api/ratings/me`, method: 'GET', duration, connections: 10, requiresAuth: true },
      { title: 'GET my watchlist', url: `${origin}/api/watchlist`, method: 'GET', duration, connections: 10, requiresAuth: true }
    );
  }
  return scenarios;
}

async function preflight(scenarios) {
  const login = scenarios.find((scenario) => scenario.method === 'POST');
  const loginResponse = await fetch(login.url, {
    method: login.method, headers: login.headers, body: login.body,
    signal: AbortSignal.timeout(10000),
  });
  if (loginResponse.status !== 200) {
    throw new Error(`Login preflight returned HTTP ${loginResponse.status}; benchmark stopped.`);
  }
  const loginData = await loginResponse.json();
  if (typeof loginData.data?.token !== 'string' || !loginData.data.token) {
    throw new Error('Login preflight did not return a token; benchmark stopped.');
  }

  for (const scenario of scenarios) {
    if (scenario === login) continue;
    if (scenario.requiresAuth) {
      scenario.headers = { Authorization: `Bearer ${loginData.data.token}` };
    }
    const response = await fetch(scenario.url, {
      method: scenario.method, headers: scenario.headers, signal: AbortSignal.timeout(10000),
    });
    if (response.status !== 200) {
      throw new Error(`${scenario.title} preflight returned HTTP ${response.status}; benchmark stopped.`);
    }
    const body = await response.json();
    if (!Object.prototype.hasOwnProperty.call(body, 'data')) {
      throw new Error(`${scenario.title} preflight returned an unexpected body; benchmark stopped.`);
    }
  }
}

function percentile(values, percent) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(percent / 100 * sorted.length) - 1];
}

function summarize(result, latencies) {
  const statuses = result.statusCodeStats || {};
  const completed = Object.values(statuses).reduce((total, value) => total + value.count, 0);
  const failedHttp = Object.entries(statuses)
    .filter(([code]) => Number(code) !== 200)
    .reduce((total, [, value]) => total + value.count, 0);
  // autocannon.errors already includes timeouts; do not count them twice.
  const failed = failedHttp + result.errors;
  const total = completed + result.errors;
  return {
    rps: result.requests.average,
    latencyAverageMs: result.latency.average,
    latencyP95Ms: percentile(latencies, 95),
    latencyP99Ms: result.latency.p99,
    completedHttpRequests: completed,
    networkErrors: result.errors,
    timeouts: result.timeouts,
    failedRequests: failed,
    errorRatePercent: total ? failed / total * 100 : null,
    statusCodeStats: statuses,
  };
}

async function runScenario(opts) {
  console.log(`\n━━━ ${opts.title} ━━━`);
  const latencies = [];
  const result = await new Promise((resolve, reject) => {
    const instance = autocannon({
      url: opts.url, method: opts.method, duration: opts.duration,
      connections: opts.connections, headers: opts.headers, body: opts.body,
    }, (err, value) => err ? reject(err) : resolve(value));
    instance.on('response', (_client, _status, _bytes, responseTime) => latencies.push(responseTime));
  });
  console.log(autocannon.printResult(result));
  const summary = summarize(result, latencies);
  console.log(JSON.stringify({ scenario: opts.title, ...summary }, null, 2));
  if (summary.failedRequests > 0 || summary.completedHttpRequests === 0) {
    throw new Error(`${opts.title} has failed or zero requests; do not treat this as a successful baseline.`);
  }
  return summary;
}

async function main() {
  const mode = process.env.LOAD_TEST_MODE || 'all';
  if (mode === 'all') {
    await runAllEndpointBenchmark();
    return;
  }
  if (mode !== 'baseline') {
    throw new Error('LOAD_TEST_MODE must be "all" or "baseline".');
  }

  const scenarios = createScenarios();
  console.log('CineRate Load Test');
  console.log(JSON.stringify({
    node: process.version, platform: process.platform, arch: process.arch,
    cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length,
    memoryGiB: os.totalmem() / 1024 ** 3,
    durationPerScenario: scenarios[0].duration,
    connections: scenarios.map(({ title, connections }) => ({ title, connections })),
  }, null, 2));
  await preflight(scenarios);
  for (const scenario of scenarios) {
    await runScenario(scenario);
  }
  console.log('\n All scenarios completed.');
}

const ALL_ENDPOINTS = [
  'GET /health',
  'POST /api/auth/register',
  'POST /api/auth/login',
  'GET /api/auth/profile',
  'PUT /api/auth/profile',
  'GET /api/movies',
  'POST /api/movies',
  'GET /api/movies/:id',
  'DELETE /api/movies/:id',
  'GET /api/genres',
  'POST /api/movies/:id/ratings',
  'GET /api/movies/:id/ratings/summary',
  'GET /api/ratings/me',
  'GET /api/movies/:id/reviews',
  'POST /api/movies/:id/reviews',
  'DELETE /api/reviews/:id',
  'GET /api/watchlist',
  'POST /api/watchlist',
  'DELETE /api/watchlist/:movieId',
];

function createAllEndpointConfig(env = process.env) {
  if (!env.LOAD_TEST_PASSWORD) {
    throw new Error('Set LOAD_TEST_PASSWORD to the password used for benchmark accounts.');
  }
  const baseUrl = new URL(env.BASE_URL || 'http://localhost:3000');
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new Error('BASE_URL must be an HTTP(S) URL without embedded credentials.');
  }
  const durationText = env.LOAD_TEST_DURATION || '10';
  if (!/^[1-9]\d*$/.test(durationText) || Number(durationText) > 3600) {
    throw new Error('LOAD_TEST_DURATION must be an integer from 1 to 3600 seconds.');
  }
  const connectionsText = env.LOAD_TEST_CONNECTIONS || '10';
  if (!/^[1-9]\d*$/.test(connectionsText) || Number(connectionsText) > 100) {
    throw new Error('LOAD_TEST_CONNECTIONS must be an integer from 1 to 100.');
  }
  const movieId = env.LOAD_TEST_MOVIE_ID || '1';
  if (!/^[1-9]\d*$/.test(movieId) || Number(movieId) > 2147483647) {
    throw new Error('LOAD_TEST_MOVIE_ID must be a positive Prisma Int.');
  }
  return {
    baseUrl: baseUrl.href.replace(/\/$/, ''),
    password: env.LOAD_TEST_PASSWORD,
    duration: Number(durationText),
    connections: Number(connectionsText),
    movieId,
  };
}

function createRouteMetrics() {
  return Object.fromEntries(ALL_ENDPOINTS.map((name) => [name, {
    requests: 0,
    successes: 0,
    failures: 0,
    networkErrors: 0,
    statuses: {},
    latencies: [],
    latencyObservations: 0,
  }]));
}

function recordRoute(metrics, route, { status, latencyMs, error = false, success = false }) {
  const item = metrics[route];
  item.requests += 1;
  if (status != null) item.statuses[status] = (item.statuses[status] || 0) + 1;
  if (error) item.networkErrors += 1;
  if (success) item.successes += 1;
  else item.failures += 1;
  if (latencyMs != null) {
    item.latencyObservations += 1;
    if (item.latencies.length < LATENCY_SAMPLE_LIMIT) {
      item.latencies.push(latencyMs);
    } else {
      // Keep a uniform reservoir sample so high-throughput/long runs stay memory-bounded.
      const index = Math.floor(Math.random() * item.latencyObservations);
      if (index < LATENCY_SAMPLE_LIMIT) item.latencies[index] = latencyMs;
    }
  }
}

async function endpointRequest(config, metrics, route, method, path, {
  token, body, expectedStatus = 200, validate = () => true,
} = {}) {
  const started = performance.now();
  let response;
  let text = '';
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000),
    });
    text = await response.text();
  } catch (err) {
    recordRoute(metrics, route, {
      status: null,
      latencyMs: performance.now() - started,
      error: true,
    });
    throw new Error(`${route} network error: ${err.message}`);
  }

  const latencyMs = performance.now() - started;
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }
  const success = response.status === expectedStatus && validate(payload);
  recordRoute(metrics, route, { status: response.status, latencyMs, success });
  if (!success) {
    throw new Error(`${route} returned HTTP ${response.status}; expected HTTP ${expectedStatus}.`);
  }
  return payload;
}

async function prepareWorkerFixtures(config, runPrefix) {
  const metrics = createRouteMetrics();
  const fixtures = [];
  for (let workerId = 0; workerId < config.connections; workerId += 1) {
    const username = `${runPrefix}-fixture-${workerId}`;
    const password = config.password;
    await endpointRequest(config, metrics, 'POST /api/auth/register', 'POST', '/api/auth/register', {
      body: { username, email: `${username}@example.test`, password },
      expectedStatus: 201,
      validate: (payload) => Number.isInteger(payload?.data?.id),
    });
    const loginPayload = await endpointRequest(config, metrics, 'POST /api/auth/login', 'POST', '/api/auth/login', {
      body: { username, password },
      validate: (payload) => typeof payload?.data?.token === 'string',
    });
    fixtures.push({ id: loginPayload.data.user.id, username, password, token: loginPayload.data.token });
  }
  return fixtures;
}

async function runMeasuredEndpoint({ config, metrics, prisma, runPrefix, route, fixture, workerId, iteration }) {
  const suffix = `${workerId}-${iteration}`;
  const contentPrefix = `Kaggle benchmark review ${runPrefix}-${route}`;
  const movieTitlePrefix = `Kaggle bench ${runPrefix}-${route}`;
  const options = { token: fixture?.token };
  const request = (method, path, requestOptions = {}) => endpointRequest(
    config, metrics, route, method, path, requestOptions
  );

  switch (route) {
    case 'GET /health':
      await request('GET', '/health', { validate: (payload) => payload?.status === 'ok' });
      break;
    case 'POST /api/auth/register': {
      const username = `${runPrefix}-register-${suffix}`;
      await request('POST', '/api/auth/register', {
        body: { username, email: `${username}@example.test`, password: config.password },
        expectedStatus: 201,
        validate: (payload) => Number.isInteger(payload?.data?.id),
      });
      break;
    }
    case 'POST /api/auth/login':
      await request('POST', '/api/auth/login', {
        body: { username: fixture.username, password: fixture.password },
        validate: (payload) => typeof payload?.data?.token === 'string',
      });
      break;
    case 'GET /api/auth/profile':
      await request('GET', '/api/auth/profile', {
        ...options, validate: (payload) => Number.isInteger(payload?.data?.id),
      });
      break;
    case 'PUT /api/auth/profile': {
      const email = `profile-${runPrefix}-${suffix}@example.test`;
      await request('PUT', '/api/auth/profile', {
        ...options, body: { email },
        validate: (payload) => payload?.data?.email === email,
      });
      break;
    }
    case 'GET /api/movies':
      await request('GET', '/api/movies', { validate: (payload) => Array.isArray(payload?.data) });
      break;
    case 'POST /api/movies': {
      await request('POST', '/api/movies', {
        ...options, body: { title: `${movieTitlePrefix} ${suffix}`, releaseYear: 2020 },
        expectedStatus: 201, validate: (payload) => Number.isInteger(payload?.data?.id),
      });
      break;
    }
    case 'GET /api/movies/:id':
      await request('GET', `/api/movies/${config.movieId}`, {
        validate: (payload) => payload?.data?.id === Number(config.movieId),
      });
      break;
    case 'DELETE /api/movies/:id': {
      const movie = await prisma.movie.create({
        data: { title: `${movieTitlePrefix} ${suffix}`, releaseYear: 2020 },
      });
      try {
        await request('DELETE', `/api/movies/${movie.id}`, {
          ...options, validate: (payload) => typeof payload?.message === 'string',
        });
      } finally {
        await prisma.movie.deleteMany({ where: { id: movie.id } });
      }
      break;
    }
    case 'GET /api/genres':
      await request('GET', '/api/genres', { validate: (payload) => Array.isArray(payload?.data) });
      break;
    case 'POST /api/movies/:id/ratings':
      await request('POST', `/api/movies/${config.movieId}/ratings`, {
        ...options, body: { score: 8 },
        validate: (payload) => Number.isFinite(payload?.data?.score),
      });
      break;
    case 'GET /api/movies/:id/ratings/summary':
      await request('GET', `/api/movies/${config.movieId}/ratings/summary`, {
        validate: (payload) => Number.isInteger(payload?.data?.ratingCount),
      });
      break;
    case 'GET /api/ratings/me':
      await request('GET', '/api/ratings/me', {
        ...options, validate: (payload) => Array.isArray(payload?.data),
      });
      break;
    case 'GET /api/movies/:id/reviews':
      await request('GET', `/api/movies/${config.movieId}/reviews`, {
        validate: (payload) => Array.isArray(payload?.data),
      });
      break;
    case 'POST /api/movies/:id/reviews':
      await request('POST', `/api/movies/${config.movieId}/reviews`, {
        ...options, body: { content: `${contentPrefix} ${suffix}` },
        expectedStatus: 201, validate: (payload) => Number.isInteger(payload?.data?.id),
      });
      break;
    case 'DELETE /api/reviews/:id': {
      const review = await prisma.review.create({
        data: { content: `${contentPrefix} ${suffix}`, userId: fixture.id, movieId: Number(config.movieId) },
      });
      try {
        await request('DELETE', `/api/reviews/${review.id}`, {
          ...options, validate: (payload) => typeof payload?.message === 'string',
        });
      } finally {
        await prisma.review.deleteMany({ where: { id: review.id } });
      }
      break;
    }
    case 'GET /api/watchlist':
      await request('GET', '/api/watchlist', {
        ...options, validate: (payload) => Array.isArray(payload?.data),
      });
      break;
    case 'POST /api/watchlist':
      await prisma.watchlist.deleteMany({ where: { userId: fixture.id, movieId: Number(config.movieId) } });
      try {
        await request('POST', '/api/watchlist', {
          ...options, body: { movieId: Number(config.movieId) }, expectedStatus: 201,
          validate: (payload) => payload?.data?.movieId === Number(config.movieId),
        });
      } finally {
        await prisma.watchlist.deleteMany({ where: { userId: fixture.id, movieId: Number(config.movieId) } });
      }
      break;
    case 'DELETE /api/watchlist/:movieId':
      await prisma.watchlist.deleteMany({ where: { userId: fixture.id, movieId: Number(config.movieId) } });
      await prisma.watchlist.create({ data: { userId: fixture.id, movieId: Number(config.movieId) } });
      try {
        await request('DELETE', `/api/watchlist/${config.movieId}`, {
          ...options, validate: (payload) => typeof payload?.message === 'string',
        });
      } finally {
        await prisma.watchlist.deleteMany({ where: { userId: fixture.id, movieId: Number(config.movieId) } });
      }
      break;
    default:
      throw new Error(`No benchmark operation configured for ${route}.`);
  }
}

async function cleanupBenchmarkData(databaseUrl, runPrefix, existingClient) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required for safe full-endpoint cleanup.');
  const { PrismaClient } = require('@prisma/client');
  const prisma = existingClient || new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.movie.deleteMany({ where: { title: { startsWith: `Kaggle bench ${runPrefix}-` } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: `${runPrefix}-` } } });
  } finally {
    if (!existingClient) await prisma.$disconnect();
  }
}

function summarizeRouteMetrics(metrics, elapsedByRoute = {}) {
  return Object.fromEntries(Object.entries(metrics).map(([route, value]) => {
    const elapsedSeconds = elapsedByRoute[route] || 0;
    return [route, {
      requests: value.requests,
      measuredSeconds: elapsedSeconds ? Number(elapsedSeconds.toFixed(2)) : null,
      requestsPerSecond: elapsedSeconds ? Number((value.requests / elapsedSeconds).toFixed(2)) : null,
      successes: value.successes,
      failures: value.failures,
      networkErrors: value.networkErrors,
      errorRatePercent: value.requests ? Number((value.failures / value.requests * 100).toFixed(3)) : null,
      latencyObservations: value.latencyObservations,
      latencySamples: value.latencies.length,
      latencyAverageMs: value.latencies.length
        ? Number((value.latencies.reduce((sum, latency) => sum + latency, 0) / value.latencies.length).toFixed(2))
        : null,
      latencyP95Ms: Number.isFinite(percentile(value.latencies, 95))
        ? Number(percentile(value.latencies, 95).toFixed(2)) : null,
      latencyP99Ms: Number.isFinite(percentile(value.latencies, 99))
        ? Number(percentile(value.latencies, 99).toFixed(2)) : null,
      statusCodes: value.statuses,
    }];
  }));
}

async function cleanupRouteData(prisma, config, runPrefix, route, fixtures) {
  const fixtureIds = fixtures.map(({ id }) => id);
  if (route === 'POST /api/auth/register') {
    await prisma.user.deleteMany({ where: { username: { startsWith: `${runPrefix}-register-` } } });
  } else if (route === 'POST /api/movies' || route === 'DELETE /api/movies/:id') {
    const movieTitlePrefix = `Kaggle bench ${runPrefix}-${route} `;
    await prisma.movie.deleteMany({ where: { title: { startsWith: movieTitlePrefix } } });
  } else if (
    route === 'POST /api/movies/:id/ratings' ||
    route === 'GET /api/movies/:id/ratings/summary' ||
    route === 'GET /api/ratings/me'
  ) {
    await prisma.rating.deleteMany({ where: { userId: { in: fixtureIds }, movieId: Number(config.movieId) } });
  } else if (
    route === 'POST /api/movies/:id/reviews' ||
    route === 'DELETE /api/reviews/:id' ||
    route === 'GET /api/movies/:id/reviews'
  ) {
    const contentPrefix = `Kaggle benchmark review ${runPrefix}-${route}`;
    await prisma.review.deleteMany({
      where: {
        userId: { in: fixtureIds },
        movieId: Number(config.movieId),
        content: { startsWith: contentPrefix },
      },
    });
  } else if (route === 'GET /api/watchlist') {
    await prisma.watchlist.deleteMany({ where: { userId: { in: fixtureIds } } });
  }
}

async function prepareRouteData(prisma, config, runPrefix, route, fixtures) {
  if (
    route === 'GET /api/movies/:id/ratings/summary' ||
    route === 'GET /api/ratings/me'
  ) {
    await Promise.all(fixtures.map(({ id }) => prisma.rating.create({
      data: { userId: id, movieId: Number(config.movieId), score: 8 },
    })));
  } else if (route === 'GET /api/movies/:id/reviews') {
    const contentPrefix = `Kaggle benchmark review ${runPrefix}-${route}`;
    await Promise.all(fixtures.map(({ id }, workerId) => prisma.review.create({
      data: {
        content: `${contentPrefix} ${workerId}`,
        userId: id,
        movieId: Number(config.movieId),
      },
    })));
  } else if (route === 'GET /api/watchlist') {
    await Promise.all(fixtures.map(({ id }) => prisma.watchlist.create({
      data: { userId: id, movieId: Number(config.movieId) },
    })));
  }
}

async function runAllEndpointBenchmark(env = process.env) {
  const config = createAllEndpointConfig(env);
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for all-endpoint benchmark cleanup.');
  const runPrefix = `kagglebench-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const metrics = createRouteMetrics();
  const elapsedByRoute = {};
  const setupFailures = [];
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  console.log('CineRate All-Endpoint Load Test');
  console.log(JSON.stringify({
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    memoryGiB: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
    durationPerRunSeconds: config.duration,
    connections: config.connections,
    endpointCount: ALL_ENDPOINTS.length,
    movieId: config.movieId,
    workload: 'Each endpoint is benchmarked independently with concurrent clients; stateful routes use disposable fixtures.',
  }, null, 2));

  try {
    await prisma.$connect();
    const fixtures = await prepareWorkerFixtures(config, runPrefix);
    const movieCheck = await fetch(`${config.baseUrl}/api/movies/${config.movieId}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (movieCheck.status !== 200) {
      throw new Error(`LOAD_TEST_MOVIE_ID preflight returned HTTP ${movieCheck.status}; use an existing movie ID.`);
    }

    for (const route of ALL_ENDPOINTS) {
      console.log(`\n━━━ ${route} ━━━`);
      await prepareRouteData(prisma, config, runPrefix, route, fixtures);
      const started = performance.now();
      const deadline = started + config.duration * 1000;
      let reportedRequestErrors = 0;
      const workers = Array.from({ length: config.connections }, async (_unused, workerId) => {
        let iteration = 0;
        while (performance.now() < deadline) {
          const requestsBefore = metrics[route].requests;
          try {
            await runMeasuredEndpoint({
              config, metrics, prisma, runPrefix, route,
              fixture: fixtures[workerId], workerId, iteration,
            });
          } catch (err) {
            if (metrics[route].requests === requestsBefore) {
              setupFailures.push(`${route}: ${err.message}`);
              return;
            }
            if (reportedRequestErrors < 5) {
              console.error(err.message);
              reportedRequestErrors += 1;
            }
          }
          iteration += 1;
        }
      });
      await Promise.all(workers);
      elapsedByRoute[route] = (performance.now() - started) / 1000;
      await cleanupRouteData(prisma, config, runPrefix, route, fixtures);
    }
  } finally {
    try {
      await cleanupBenchmarkData(databaseUrl, runPrefix, prisma);
    } finally {
      await prisma.$disconnect();
    }
  }

  const measuredSeconds = Object.values(elapsedByRoute).reduce((total, seconds) => total + seconds, 0);
  const summary = summarizeRouteMetrics(metrics, elapsedByRoute);
  const totalRequests = Object.values(metrics).reduce((total, item) => total + item.requests, 0);
  const totalFailures = Object.values(metrics).reduce((total, item) => total + item.failures, 0);
  const endpointsWithoutRequests = Object.entries(metrics).filter(([, item]) => item.requests === 0).map(([route]) => route);
  console.log(JSON.stringify({
    completedEndpoints: Object.keys(elapsedByRoute).length,
    totalRequests,
    aggregateRequestsPerSecond: measuredSeconds ? Number((totalRequests / measuredSeconds).toFixed(2)) : null,
    measuredSeconds: Number(measuredSeconds.toFixed(2)),
    failedRequests: totalFailures,
    endpointsWithoutRequests,
    setupFailures,
    endpointMetrics: summary,
  }, null, 2));

  if (totalFailures > 0 || endpointsWithoutRequests.length > 0 || setupFailures.length > 0) {
    throw new Error('All-endpoint benchmark had failed requests, setup errors, or endpoints with no measured requests.');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  ALL_ENDPOINTS,
  createScenarios,
  createAllEndpointConfig,
  createRouteMetrics,
  endpointRequest,
  prepareWorkerFixtures,
  preflight,
  percentile,
  summarize,
  summarizeRouteMetrics,
  runMeasuredEndpoint,
  runAllEndpointBenchmark,
  runScenario,
  main,
};
