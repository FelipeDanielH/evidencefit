import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('API bootstrap', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the health endpoint', async () => {
    const apiUrl = await app.getUrl();

    await request(apiUrl)
      .get('/api/health')
      .expect(200)
      .expect({ service: 'evidencefit-api', status: 'ok' });
  });

  it('protects domain endpoints with JWT while keeping health public', async () => {
    const apiUrl = await app.getUrl();

    await request(apiUrl).get('/api/jobs').expect(401);
    await request(apiUrl).get('/api/candidates').expect(401);
    await request(apiUrl).post('/api/evaluations').send({}).expect(401);
    await request(apiUrl).get('/api/jobs/job-1/comparison?evaluationIds=a,b').expect(401);
  });
});
