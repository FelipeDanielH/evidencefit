import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AiModule } from './ai/ai.module.js';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { CandidatesModule } from './candidates/candidates.module.js';
import { DatabaseModule } from './database/database.module.js';
import { EvaluationsModule } from './evaluations/evaluations.module.js';
import { JobsModule } from './jobs/jobs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['.env', '../../.env'],
      expandVariables: true,
      isGlobal: true,
    }),
    DatabaseModule,
    AuthModule,
    JobsModule,
    CandidatesModule,
    AiModule,
    EvaluationsModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
