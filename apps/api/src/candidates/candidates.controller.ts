import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Candidate } from '../generated/prisma/client.js';
import type { StoredCandidateEvidence } from './candidate-evidence.store.js';
import { CandidatesService, type CandidateDetail } from './candidates.service.js';
import { CreateCandidateDto } from './dto/create-candidate.dto.js';

@Controller('candidates')
export class CandidatesController {
  constructor(private readonly candidatesService: CandidatesService) {}

  @Post()
  create(@Body() input: CreateCandidateDto): Promise<Candidate> {
    return this.candidatesService.create(input);
  }

  @Get()
  findAll(): Promise<Candidate[]> {
    return this.candidatesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<CandidateDetail> {
    return this.candidatesService.findOne(id);
  }

  @Post(':id/extract-evidence')
  extractEvidence(@Param('id') id: string): Promise<StoredCandidateEvidence> {
    return this.candidatesService.extractEvidence(id);
  }
}
