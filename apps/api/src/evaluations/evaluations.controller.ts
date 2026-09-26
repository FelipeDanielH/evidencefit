import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateEvaluationDto } from './dto/create-evaluation.dto.js';
import { EvaluationsService, type EvaluationDetail } from './evaluations.service.js';

@Controller('evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post()
  create(@Body() input: CreateEvaluationDto): Promise<EvaluationDetail> {
    return this.evaluationsService.create(input);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<EvaluationDetail> {
    return this.evaluationsService.findOne(id);
  }
}
