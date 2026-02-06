import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Min,
} from 'class-validator';

export class CreateSeatDto {
	@ApiProperty({ description: 'ID da licença', required: false })
	@IsString()
	@IsOptional()
	licenseId?: string;

	@ApiProperty({ description: 'ID do usuário a alocar' })
	@IsString()
	@IsNotEmpty()
	userId: string;

	@ApiProperty({ description: 'Duração do seat em dias', minimum: 1 })
	@IsInt()
	@Min(1)
	@IsNotEmpty()
	duration: number;

	@ApiPropertyOptional({ description: 'Seat ativo', default: true })
	@IsBoolean()
	@IsOptional()
	isActive?: boolean;
}
