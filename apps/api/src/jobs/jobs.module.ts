import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { config } from 'dotenv';
import { AiModule } from '../ai/ai.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JobRequirementsStore } from './job-requirements.store.js';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import {
  JobRequirementsExtractionEntity,
  JobRequirementsExtractionSchema,
} from './schemas/job-requirements.schema.js';

config({ path: ['.env', '../../.env'], quiet: true });

const mongooseImports = process.env.MONGODB_URI?.trim()
  ? [
      MongooseModule.forFeature([
        {
          name: JobRequirementsExtractionEntity.name,
          schema: JobRequirementsExtractionSchema,
        },
      ]),
    ]
  : [];

@Module({
  imports: [DatabaseModule, AiModule, ...mongooseImports],
  controllers: [JobsController],
  providers: [JobsService, JobRequirementsStore],
  exports: [JobsService, JobRequirementsStore],
})
export class JobsModule {}
