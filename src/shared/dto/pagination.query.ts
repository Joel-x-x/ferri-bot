import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
