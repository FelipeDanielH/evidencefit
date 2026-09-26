import { readFile } from 'node:fs/promises';

const apiUrl = process.env.SMOKE_API_URL?.replace(/\/$/, '');
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!apiUrl || !email || !password) {
  throw new Error('SMOKE_API_URL, SMOKE_EMAIL and SMOKE_PASSWORD are required.');
}

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/demo-v0.1.json', import.meta.url), 'utf8'),
);

async function request(path, init = {}, accessToken) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  return { payload, response };
}

function expectOk(result, step) {
  if (!result.response.ok) {
    throw new Error(
      `${step} failed (${result.response.status}): ${JSON.stringify(result.payload)}`,
    );
  }
  return result.payload;
}

const health = await request('/health');
expectOk(health, 'healthcheck');

const register = await request('/auth/register', {
  body: JSON.stringify({ email, password }),
  method: 'POST',
});
if (!register.response.ok && register.response.status !== 409) {
  expectOk(register, 'register');
}

const login = expectOk(
  await request('/auth/login', {
    body: JSON.stringify({ email, password }),
    method: 'POST',
  }),
  'login',
);
if (!login || typeof login.accessToken !== 'string') throw new Error('Login did not return a JWT.');
const token = login.accessToken;

const job = expectOk(
  await request('/jobs', { body: JSON.stringify(fixture.job), method: 'POST' }, token),
  'create job',
);
expectOk(
  await request(`/jobs/${job.id}/extract-requirements`, { method: 'POST' }, token),
  'extract requirements',
);

const evaluationIds = [];
for (const candidateFixture of fixture.candidates) {
  const candidate = expectOk(
    await request(
      '/candidates',
      {
        body: JSON.stringify({
          cvText: candidateFixture.cvText,
          isSynthetic: true,
          name: candidateFixture.name,
        }),
        method: 'POST',
      },
      token,
    ),
    `create candidate ${candidateFixture.profile}`,
  );
  expectOk(
    await request(`/candidates/${candidate.id}/extract-evidence`, { method: 'POST' }, token),
    `extract evidence ${candidateFixture.profile}`,
  );
  const evaluation = expectOk(
    await request(
      '/evaluations',
      { body: JSON.stringify({ candidateId: candidate.id, jobId: job.id }), method: 'POST' },
      token,
    ),
    `evaluate ${candidateFixture.profile}`,
  );
  expectOk(await request(`/evaluations/${evaluation.id}`, {}, token), 'read evaluation');
  evaluationIds.push(evaluation.id);
}

const comparison = expectOk(
  await request(
    `/jobs/${job.id}/comparison?evaluationIds=${encodeURIComponent(evaluationIds.join(','))}`,
    {},
    token,
  ),
  'compare candidates',
);
if (!Array.isArray(comparison?.candidates) || comparison.candidates.length !== 3) {
  throw new Error('Comparison did not contain all three candidates.');
}

process.stdout.write(
  `${JSON.stringify({ candidates: comparison.candidates.length, health: 'ok', jobId: job.id, status: 'passed' })}\n`,
);
