import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Job } from '../generated/prisma/client.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import type { StoredJobRequirements } from './job-requirements.store.js';
import { JobsService, type JobDetail } from './jobs.service.js';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() input: CreateJobDto): Promise<Job> {
    return this.jobsService.create(input);
  }

  @Get()
  findAll(): Promise<Job[]> {
    return this.jobsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<JobDetail> {
    return this.jobsService.findOne(id);
  }

  @Post(':id/extract-requirements')
  extractRequirements(@Param('id') id: string): Promise<StoredJobRequirements> {
    return this.jobsService.extractRequirements(id);
  }
}
