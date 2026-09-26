import { Controller, Get, UseGuards, ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { jest } from '@jest/globals';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { PasswordHashService } from '../src/auth/password-hash.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { User } from '../src/generated/prisma/client.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected a JSON object response.');
  return value;
}

@Controller('protected-test')
@UseGuards(JwtAuthGuard)
class ProtectedTestController {
  @Get()
  getProtected(): { authenticated: true } {
    return { authenticated: true };
  }
}

describe('Auth API', () => {
  let app: INestApplication;
  let apiUrl: string;
  let passwordHashService: PasswordHashService;
  const users = new Map<string, User>();

  const prismaMock = {
    client: {
      user: {
        create: jest.fn(
          ({ data }: { data: { email: string; passwordHash: string } }): Promise<User> => {
            if (users.has(data.email)) {
              return Promise.reject(
                Object.assign(new Error('Unique constraint violation.'), { code: 'P2002' }),
              );
            }
            const now = new Date('2026-09-25T18:00:00.000Z');
            const user: User = {
              createdAt: now,
              email: data.email,
              id: `user-${users.size + 1}`,
              passwordHash: data.passwordHash,
              updatedAt: now,
            };
            users.set(user.email, user);
            return Promise.resolve(user);
          },
        ),
        findUnique: jest.fn(({ where }: { where: { email: string } }): Promise<User | null> =>
          Promise.resolve(users.get(where.email) ?? null),
        ),
      },
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule],
      controllers: [ProtectedTestController],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    passwordHashService = moduleFixture.get(PasswordHashService);
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true }),
    );
    await app.listen(0, '127.0.0.1');
    apiUrl = await app.getUrl();
  });

  beforeEach(() => {
    users.clear();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a normalized user, hashes the password and issues a JWT', async () => {
    const response = await request(apiUrl).post('/api/auth/register').send({
      email: '  DEMO@Example.com ',
      password: 'synthetic-password',
    });

    expect(response.status).toBe(201);
    const body: unknown = response.body;
    expect(isRecord(body)).toBe(true);
    if (!isRecord(body)) throw new Error('Expected an auth response.');
    expect(typeof body.accessToken).toBe('string');
    expect(body.user).toEqual(expect.objectContaining({ email: 'demo@example.com', id: 'user-1' }));
    const storedUser = users.get('demo@example.com');
    expect(storedUser?.passwordHash).not.toBe('synthetic-password');
    expect(
      storedUser
        ? await passwordHashService.verify('synthetic-password', storedUser.passwordHash)
        : false,
    ).toBe(true);
  });

  it('logs in with valid credentials and returns a JWT', async () => {
    await request(apiUrl).post('/api/auth/register').send({
      email: 'demo@example.com',
      password: 'synthetic-password',
    });

    const response = await request(apiUrl).post('/api/auth/login').send({
      email: 'DEMO@example.com',
      password: 'synthetic-password',
    });

    expect(response.status).toBe(201);
    const body = responseRecord(response.body);
    const user = responseRecord(body.user);
    expect(typeof body.accessToken).toBe('string');
    expect(user.email).toBe('demo@example.com');
  });

  it('returns the same controlled login error for unknown users and bad passwords', async () => {
    await request(apiUrl).post('/api/auth/register').send({
      email: 'demo@example.com',
      password: 'synthetic-password',
    });
    const unknown = await request(apiUrl).post('/api/auth/login').send({
      email: 'unknown@example.com',
      password: 'synthetic-password',
    });
    const incorrect = await request(apiUrl).post('/api/auth/login').send({
      email: 'demo@example.com',
      password: 'incorrect-password',
    });

    expect(unknown.status).toBe(401);
    expect(incorrect.status).toBe(401);
    expect(responseRecord(unknown.body).message).toBe('Email o contraseña inválidos.');
    expect(responseRecord(incorrect.body).message).toBe('Email o contraseña inválidos.');
  });

  it('rejects duplicate registration with a controlled response', async () => {
    const input = { email: 'demo@example.com', password: 'synthetic-password' };
    await request(apiUrl).post('/api/auth/register').send(input);
    const response = await request(apiUrl).post('/api/auth/register').send(input);

    expect(response.status).toBe(409);
    expect(responseRecord(response.body).message).toBe('No fue posible registrar esta cuenta.');
  });

  it('validates registration DTOs', async () => {
    const response = await request(apiUrl).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'short',
      unexpected: true,
    });

    expect(response.status).toBe(400);
  });

  it('accepts a valid bearer token and rejects a missing token', async () => {
    const registration = await request(apiUrl).post('/api/auth/register').send({
      email: 'demo@example.com',
      password: 'synthetic-password',
    });
    const accessToken = responseRecord(registration.body).accessToken;
    if (typeof accessToken !== 'string') throw new Error('Expected an access token.');

    await request(apiUrl).get('/api/protected-test').expect(401);
    await request(apiUrl)
      .get('/api/protected-test')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect({ authenticated: true });
  });
});
