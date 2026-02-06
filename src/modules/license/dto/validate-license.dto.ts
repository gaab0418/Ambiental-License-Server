import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateLicenseDto {
	@ApiProperty({ description: 'Chave da licença para validar' })
	@IsString()
	@IsNotEmpty()
	key: string;
}
