import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export const USER_ROLES = ['USER', 'ADMIN'] as const;

// Todos os campos são opcionais. Como a classe tem validação, o ValidationPipe
// (whitelist + forbidNonWhitelisted) rejeita qualquer campo fora desta lista.
// Só administradores chegam a este endpoint, então só eles podem mudar o papel.
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ enum: USER_ROLES })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: (typeof USER_ROLES)[number];
}
