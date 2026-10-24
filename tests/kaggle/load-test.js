'use strict';

const autocannon = require('autocannon');
const os = require('os');

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

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

module.exports = { createScenarios, preflight, percentile, summarize, runScenario, main };
