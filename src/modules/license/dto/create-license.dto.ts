import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsBoolean,
	IsDateString,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
} from 'class-validator';

export class CreateLicenseDto {
	@ApiProperty({ description: 'Nome da licença' })
	@IsString()
	@IsNotEmpty()
	name: string;

	@ApiProperty({ description: 'ID da organização proprietária' })
	@IsString()
	@IsNotEmpty()
	organizationId: string;

	@ApiPropertyOptional({ description: 'Descrição da licença' })
	@IsString()
	@IsOptional()
	description?: string;

	@ApiProperty({ description: 'ID do tipo de licença' })
	@IsString()
	@IsNotEmpty()
	licenseTypeId: string;

	@ApiPropertyOptional({ description: 'Data de expiração (ISO 8601)' })
	@IsDateString()
	@IsOptional()
	expiresAt?: Date;

	@ApiPropertyOptional({
		description: 'Features da licença (JSON)',
		example: { aiTokenLimit: 10000, maxProjects: 10 },
	})
	@IsObject()
	@IsOptional()
	features?: Record<string, any>;

	@ApiPropertyOptional({ description: 'Licença ativa', default: true })
	@IsBoolean()
	@IsOptional()
	isActive?: boolean;
}
