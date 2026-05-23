import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { SUPPORTED_LANGUAGES } from '@common/enums/user.enum';

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(50, { message: 'Name must not exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least one uppercase, lowercase, and number or special character',
  })
  password: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_LANGUAGES], {
    message: `Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
  })
  preferredLanguage?: string;
}
