import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Min,
} from 'class-validator';

export class CreateLicenseTypeDto {
	@ApiProperty({ description: 'Nome do tipo de licença' })
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty({ description: 'Descrição do tipo de licença' })
	@IsString()
	@IsNotEmpty()
	description: string;

	@ApiProperty({ description: 'Preço da licença', minimum: 0 })
	@IsNumber()
	@Min(0)
	@IsNotEmpty()
	price: number;

	@ApiProperty({ description: 'Duração em dias (0 = ilimitado)', minimum: 0 })
	@IsNumber()
	@Min(0)
	@IsNotEmpty()
	duration: number;

	@ApiPropertyOptional({ description: 'Licença por seat', default: false })
	@IsBoolean()
	@IsOptional()
	isPerSeat?: boolean;

	@ApiPropertyOptional({ description: 'Número máximo de seats' })
	@IsNumber()
	@Min(0)
	@IsOptional()
	maxSeats?: number;

	@ApiPropertyOptional({
		description: 'Tipo de licença ativo',
		default: true,
	})
	@IsBoolean()
	@IsOptional()
	isActive?: boolean;
}
