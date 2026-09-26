import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { AiModule } from '../ai/ai.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { CandidateEvidenceStore } from './candidate-evidence.store.js';
import { CandidatesController } from './candidates.controller.js';
import { CandidatesService } from './candidates.service.js';
import {
  CandidateEvidenceExtractionEntity,
  CandidateEvidenceExtractionSchema,
} from './schemas/candidate-evidence.schema.js';

config({ path: ['.env', '../../.env'], quiet: true });

const mongooseImports = process.env.MONGODB_URI?.trim()
  ? [
      MongooseModule.forFeature([
        {
          name: CandidateEvidenceExtractionEntity.name,
          schema: CandidateEvidenceExtractionSchema,
        },
      ]),
    ]
  : [];

@Module({
  imports: [DatabaseModule, AiModule, ...mongooseImports],
  controllers: [CandidatesController],
  providers: [CandidatesService, CandidateEvidenceStore],
  exports: [CandidatesService, CandidateEvidenceStore],
})
export class CandidatesModule {}
