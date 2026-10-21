import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// E-mail ou telefone (com DDD).
const CONTACT = /^(?:[^\s@]+@[^\s@]+\.[^\s@]+|[\d\s()+-]{8,20})$/;

export class CreateBookingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsString()
  @MaxLength(120)
  @Matches(CONTACT, { message: 'Informe um e-mail ou telefone válido' })
  contact: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  // Horário escolhido, sempre em ponto: "2026-10-21T14:00".
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/, {
    message: 'start deve ser um horário cheio, ex.: 2026-10-21T14:00',
  })
  start: string;

  // Campo-isca: pessoas não veem; robôs preenchem. Se vier preenchido, o
  // pedido é descartado em silêncio.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
