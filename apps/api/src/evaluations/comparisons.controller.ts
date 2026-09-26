import { Controller, Get, Param, ParseArrayPipe, Query } from '@nestjs/common';
import { ComparisonService } from './comparison.service.js';
import type { ComparisonSelection, JobComparison } from './comparison.types.js';

@Controller('jobs')
export class ComparisonsController {
  constructor(private readonly comparisonService: ComparisonService) {}

  @Get(':jobId/evaluations')
  listEvaluations(@Param('jobId') jobId: string): Promise<ComparisonSelection> {
    return this.comparisonService.listEvaluations(jobId);
  }

  @Get(':jobId/comparison')
  compare(
    @Param('jobId') jobId: string,
    @Query('evaluationIds', new ParseArrayPipe({ items: String, separator: ',' }))
    evaluationIds: string[],
  ): Promise<JobComparison> {
    return this.comparisonService.compare(jobId, evaluationIds);
  }
}
