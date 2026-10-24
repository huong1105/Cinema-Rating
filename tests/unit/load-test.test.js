'use strict';

const crypto = require('crypto');
const { createScenarios, percentile, summarize } = require('../kaggle/load-test');

describe('Load test reporting', () => {
  const credentials = { LOAD_TEST_USERNAME: 'benchmark-user', LOAD_TEST_PASSWORD: crypto.randomBytes(16).toString('hex') };

  test('requires explicit credentials and retains the original baseline settings', () => {
    expect(() => createScenarios({})).toThrow('LOAD_TEST_USERNAME');
    expect(() => createScenarios({ LOAD_TEST_USERNAME: 'user' })).toThrow('LOAD_TEST_PASSWORD');
    const scenarios = createScenarios(credentials);
    expect(scenarios.map(({ method, connections, duration }) => ({ method, connections, duration }))).toEqual([
      { method: 'GET', connections: 10, duration: 10 },
      { method: 'GET', connections: 10, duration: 10 },
      { method: 'POST', connections: 5, duration: 10 },
    ]);
    expect(JSON.parse(scenarios[2].body).password).toBe(credentials.LOAD_TEST_PASSWORD);
  });

  test.each([
    { LOAD_TEST_DURATION: '0' }, { LOAD_TEST_DURATION: '1e2' },
    { LOAD_TEST_DURATION: '3601' }, { LOAD_TEST_MOVIE_ID: '0' },
    { LOAD_TEST_MOVIE_ID: '1.5' }, { LOAD_TEST_MOVIE_ID: '2147483648' },
    { BASE_URL: 'file:///tmp/test' }, { BASE_URL: 'https://user:password@example.com' },
  ])('rejects an invalid benchmark configuration %p', (config) => {
    expect(() => createScenarios({ ...credentials, ...config })).toThrow();
  });

  test('C read scenarios are opt-in and keep the baseline scenarios first', () => {
    const scenarios = createScenarios({ ...credentials, LOAD_TEST_INCLUDE_C: '1' });
    expect(scenarios).toHaveLength(7);
    expect(scenarios.slice(0, 3).map((scenario) => scenario.title)).toEqual([
      'GET /api/movies (list)', 'GET /api/movies/:id (detail)', 'POST /api/auth/login',
    ]);
    expect(scenarios.slice(5).every((scenario) => scenario.requiresAuth)).toBe(true);
  });

  test('calculates nearest-rank p95 without inventing empty-sample percentiles', () => {
    expect(percentile(Array.from({ length: 100 }, (_, index) => index + 1), 95)).toBe(95);
    expect(percentile([], 95)).toBeNull();
  });

  test('counts HTTP errors and transport errors without double-counting timeouts', () => {
    const summary = summarize({
      statusCodeStats: { 200: { count: 8 }, 401: { count: 2 } },
      errors: 2, timeouts: 1,
      requests: { average: 10 }, latency: { average: 3, p99: 5 },
    }, [1, 2, 3, 4, 5]);
    expect(summary.failedRequests).toBe(4);
    expect(summary.errorRatePercent).toBeCloseTo(100 / 3);
    expect(summary.latencyP95Ms).toBe(5);
  });

  test('does not report zero traffic as a zero-percent error baseline', () => {
    const summary = summarize({
      statusCodeStats: {}, errors: 0, timeouts: 0,
      requests: { average: 0 }, latency: { average: 0, p99: 0 },
    }, []);
    expect(summary.errorRatePercent).toBeNull();
    expect(summary.latencyP95Ms).toBeNull();
  });
});
