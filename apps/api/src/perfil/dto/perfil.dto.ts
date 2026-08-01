import { IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class HomeLocationDto {
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() municipality?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
}

export class CarDto {
  @IsIn(['diesel', 'gasolina']) fuelType!: 'diesel' | 'gasolina';
  @IsNumber() consumptionLper100!: number;
  @IsOptional() @IsNumber() fuelPricePerLiter?: number;
}

export class PerfilDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() homeLocation?: HomeLocationDto;
  @IsArray() specialties: unknown[];
  @IsOptional() @IsNumber() maxDistanceKm?: number;
  @IsOptional() @IsNumber() maxTravelMinutes?: number;
  @IsBoolean() acceptsPartialWorkload: boolean;
  @IsOptional() @IsNumber() minimumWorkload?: number;
  @IsBoolean() acceptsVoluntary: boolean;
  @IsBoolean() acceptsAfternoon: boolean;
  @IsBoolean() acceptsItinerant: boolean;
  @IsBoolean() acceptsBilingual: boolean;
  @IsBoolean() acceptsLongTerm: boolean;
  @IsArray() acceptedLanguages: string[];
  @IsArray() excludedPrograms: string[];
  @IsArray() excludedTags: string[];
  @IsArray() preferredMunicipalities: string[];
  @IsArray() excludedMunicipalities: string[];
  @IsArray() preferredCenters: string[];
  @IsArray() excludedCenters: string[];

  @IsOptional() @IsIn(['minutes', 'km']) travelMode?: 'minutes' | 'km';
  @IsOptional() @IsArray() workloadTravelTiers?: unknown[];
  @IsOptional() @IsArray() travelWorkloadBands?: unknown[];
  @IsOptional() @IsObject() conditionAccepts?: Record<string, boolean>;
  @IsOptional() @IsObject() conditionTravelLimits?: Record<string, unknown>;
  @IsOptional() car?: CarDto;
}
