import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CATEGORIES,
  CURRENCIES,
  type Category,
  type Currency,
} from '../wealth.utils';

export class CreateHoldingDto {
  @IsIn(CATEGORIES)
  category: Category;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000_000)
  amount: number;

  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: Currency;
}

export class UpdateHoldingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000_000)
  amount?: number;

  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: Currency;
}
