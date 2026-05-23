import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Min(1)
  PORT: number = 5000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '15m';

  @IsString()
  REFRESH_TOKEN_SECRET: string;

  @IsString()
  @IsOptional()
  REFRESH_TOKEN_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  MAIL_HOST: string;

  @IsNumber()
  @IsOptional()
  MAIL_PORT: number = 587;

  @IsString()
  @IsOptional()
  MAIL_USER: string;

  @IsString()
  @IsOptional()
  MAIL_PASS: string;

  @IsString()
  @IsOptional()
  MAIL_FROM: string = 'AI Chat <no-reply@aichat.com>';

  @IsString()
  @IsOptional()
  CLIENT_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api/v1';

  @IsString()
  CLOUDINARY_CLOUD_NAME: string;

  @IsString()
  CLOUDINARY_API_KEY: string;

  @IsString()
  CLOUDINARY_API_SECRET: string;
}

export function envValidation(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`❌ Env validation failed:\n${errors.toString()}`);
  }

  return validated;
}
