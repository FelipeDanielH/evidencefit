import { IsString, Matches, MaxLength } from 'class-validator';

export class CreateEvaluationDto {
  @IsString()
  @MaxLength(120)
  @Matches(/\S/, { message: 'jobId must contain visible characters' })
  jobId!: string;

  @IsString()
  @MaxLength(120)
  @Matches(/\S/, { message: 'candidateId must contain visible characters' })
  candidateId!: string;
}
