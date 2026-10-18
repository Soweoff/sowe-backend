import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  // 72 bytes é o limite real do bcrypt.
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
