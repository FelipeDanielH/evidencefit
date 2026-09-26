import { Equals, IsBoolean, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(/\S/, { message: 'name must contain visible characters' })
  name!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(50_000)
  @Matches(/\S/, { message: 'cvText must contain visible characters' })
  cvText!: string;

  @IsBoolean()
  @Equals(true, { message: 'isSynthetic must be true for demo CVs' })
  isSynthetic!: boolean;
}
