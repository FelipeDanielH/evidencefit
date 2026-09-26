import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateJobDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/\S/, { message: 'title must contain visible characters' })
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(20_000)
  @Matches(/\S/, { message: 'description must contain visible characters' })
  description!: string;
}
