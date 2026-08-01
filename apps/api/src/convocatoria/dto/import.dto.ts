import { IsArray, IsOptional, IsString } from 'class-validator';

export class ImportDto {
  @IsOptional() @IsString() sourceName?: string;
  @IsOptional() @IsString() parserVersion?: string;
  @IsArray() vacancies: Record<string, unknown>[];
}
