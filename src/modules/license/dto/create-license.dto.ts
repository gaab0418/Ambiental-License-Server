import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLicenseDto {
	@IsString()
	@IsNotEmpty()
	name: string;

	@IsString()
	@IsNotEmpty()
	key: string;

	@IsString()
	@IsNotEmpty()
	ownerId: string;

	@IsString()
	@IsOptional()
	description?: string;

	@IsString()
	@IsNotEmpty()
	licenseTypeId: string;

	@IsBoolean()
	@IsOptional()
	isActive?: boolean;
}
