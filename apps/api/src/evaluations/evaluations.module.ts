import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { CandidatesModule } from '../candidates/candidates.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { ComparisonService } from './comparison.service.js';
import { ComparisonsController } from './comparisons.controller.js';
import { EvaluationResultStore } from './evaluation-result.store.js';
import { EvaluationsController } from './evaluations.controller.js';
import { EvaluationsService } from './evaluations.service.js';
import { MatchingService } from './matching.service.js';
import {
  EvaluationResultEntity,
  EvaluationResultSchema,
} from './schemas/evaluation-result.schema.js';

config({ path: ['.env.local', '.env', '../../.env.local', '../../.env'], quiet: true });

const mongooseImports = process.env.MONGODB_URI?.trim()
  ? [
      MongooseModule.forFeature([
        {
          name: EvaluationResultEntity.name,
          schema: EvaluationResultSchema,
        },
      ]),
    ]
  : [];

@Module({
  imports: [DatabaseModule, JobsModule, CandidatesModule, ...mongooseImports],
  controllers: [EvaluationsController, ComparisonsController],
  providers: [EvaluationsService, MatchingService, EvaluationResultStore, ComparisonService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
