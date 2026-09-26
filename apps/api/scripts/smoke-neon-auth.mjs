import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: ['.env.local', '.env', '../../.env.local', '../../.env'], quiet: true });

const apiUrl = process.env.SMOKE_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3101/api';
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL_UNPOOLED or DATABASE_URL is required.');
}

const runId = randomUUID();
const email = `neon-smoke-${runId}@example.invalid`;
const password = `Neon-${runId}-A1!`;
const client = new pg.Client({ connectionString });

async function request(path, options = {}) {
  return fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
}

await client.connect();

try {
  const registerResponse = await request('/auth/register', {
    body: JSON.stringify({ email, password }),
    method: 'POST',
  });
  if (registerResponse.status !== 201) {
    throw new Error(`Register returned HTTP ${registerResponse.status}.`);
  }

  const persistedUser = await client.query(
    'SELECT id, email, "passwordHash" FROM users WHERE email = $1',
    [email],
  );
  if (persistedUser.rowCount !== 1 || persistedUser.rows[0].passwordHash === password) {
    throw new Error('The registered user was not persisted safely in PostgreSQL.');
  }

  const loginResponse = await request('/auth/login', {
    body: JSON.stringify({ email, password }),
    method: 'POST',
  });
  if (loginResponse.status !== 201) {
    throw new Error(`Login returned HTTP ${loginResponse.status}.`);
  }

  const login = await loginResponse.json();
  if (typeof login.accessToken !== 'string' || login.user?.email !== email) {
    throw new Error('Login did not return the expected JWT and public user.');
  }

  const unauthorizedResponse = await request('/jobs');
  if (unauthorizedResponse.status !== 401) {
    throw new Error(`Protected route without JWT returned HTTP ${unauthorizedResponse.status}.`);
  }

  const authorizedResponse = await request('/jobs', {
    headers: { authorization: `Bearer ${login.accessToken}` },
  });
  if (authorizedResponse.status !== 200) {
    throw new Error(`Protected route with JWT returned HTTP ${authorizedResponse.status}.`);
  }

  console.log(
    JSON.stringify({
      jwtAccepted: true,
      jwtRejectedWhenMissing: true,
      login: true,
      persistedUser: true,
      register: true,
    }),
  );
} finally {
  await client.query('DELETE FROM users WHERE email = $1', [email]);
  await client.end();
}
