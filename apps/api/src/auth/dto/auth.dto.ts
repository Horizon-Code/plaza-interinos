import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SolicitarEnlaceDto {
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  @MaxLength(254)
  email: string;
}

export class CanjearEnlaceDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token: string;
}

/**
 * El identificador que Google entrega al navegador. Se valida de verdad en
 * `GoogleService`; aquí solo se comprueba que venga algo con forma de token,
 * para no llegar a la verificación con una cadena vacía.
 */
export class EntrarConGoogleDto {
  @IsString()
  @IsNotEmpty({ message: 'Falta el identificador de Google.' })
  @MaxLength(4096)
  idToken!: string;
}
