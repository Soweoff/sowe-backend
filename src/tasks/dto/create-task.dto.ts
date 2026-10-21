import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DIFFICULTIES, type Difficulty } from '../tasks.utils';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsIn(DIFFICULTIES)
  difficulty?: Difficulty;

  // Dia planejado ("2026-10-21"); sem ele, vale hoje.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use o formato AAAA-MM-DD' })
  day?: string;
}
