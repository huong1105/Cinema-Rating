'use strict';

const autocannon = require('autocannon');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const scenarios = [
  {
    title: 'GET /api/movies (list)',
    url: `${BASE_URL}/api/movies`,
    method: 'GET',
    duration: 10,
    connections: 10,
  },
  {
    title: 'GET /api/movies/:id (detail)',
    url: `${BASE_URL}/api/movies/1`,
    method: 'GET',
    duration: 10,
    connections: 10,
  },
  {
    title: 'POST /api/auth/login',
    url: `${BASE_URL}/api/auth/login`,
    method: 'POST',
    duration: 10,
    connections: 5,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'Test@1234' }),
  },
];

async function runScenario(opts) {
  console.log(`\n━━━ ${opts.title} ━━━`);
  const result = await autocannon({
    url: opts.url,
    method: opts.method,
    duration: opts.duration,
    connections: opts.connections,
    headers: opts.headers,
    body: opts.body,
  });
  console.log(autocannon.printResult(result));
  return result;
}

(async () => {
  console.log('CineRate Load Test');
  console.log(`Target: ${BASE_URL}\n`);
  for (const scenario of scenarios) {
    await runScenario(scenario);
  }
  console.log('\n All scenarios completed.');
})();
