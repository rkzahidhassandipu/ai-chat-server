import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SearchUsersDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
