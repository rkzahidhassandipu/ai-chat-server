import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { SUPPORTED_LANGUAGES } from '@common/enums/user.enum';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'Bio must not exceed 250 characters' })
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_LANGUAGES], {
    message: `Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
  })
  preferredLanguage?: string;
}
