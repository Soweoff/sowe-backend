import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// "2026-10-17T14:30" (datetime-local) ou ISO completo, com Z/offset opcional.
const DATE_TIME =
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

// "2026-10-31" ou vazio (o formulário envia "" quando não há repetição).
const DATE_OR_EMPTY = /^(\d{4}-\d{2}-\d{2})?$/;

export const REMINDER_ACTIONS = ['email', 'popup', 'notification'] as const;
export const WEEK_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

export class ZohoEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @Matches(DATE_TIME, { message: 'start deve ser uma data/hora válida' })
  start: string;

  @IsString()
  @Matches(DATE_TIME, { message: 'end deve ser uma data/hora válida' })
  end: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsString()
  @Matches(DATE_OR_EMPTY, { message: 'repeatUntil deve ser yyyy-MM-dd' })
  repeatUntil?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(WEEK_DAYS, { each: true })
  daysOfWeek?: string[];

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @IsOptional()
  @IsIn(REMINDER_ACTIONS)
  reminderAction?: (typeof REMINDER_ACTIONS)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(40320) // até 4 semanas
  reminderMinutes?: number;

  @IsOptional()
  @IsBoolean()
  notifyPersonal?: boolean;

  @IsOptional()
  @IsEmail()
  attendeeEmail?: string;
}
