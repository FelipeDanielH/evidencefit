import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator.js';

interface HealthResponse {
  service: 'evidencefit-api';
  status: 'ok';
}

@Controller('health')
@Public()
export class AppController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: 'evidencefit-api',
      status: 'ok',
    };
  }
}
