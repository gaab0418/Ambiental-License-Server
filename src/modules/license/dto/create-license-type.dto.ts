import {
	IsBoolean,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
} from 'class-validator';

export class CreateLicenseTypeDto {
	@IsString()
	@IsNotEmpty()
	name: string;

	@IsString()
	@IsNotEmpty()
	description: string;

	@IsNumber()
	@IsNotEmpty()
	price: number;

	@IsNumber()
	@IsNotEmpty()
	duration: number;

	@IsBoolean()
	@IsOptional()
	isPerSeat?: boolean;

	@IsNumber()
	@IsOptional()
	maxSeats?: number;

	@IsBoolean()
	@IsOptional()
	isActive?: boolean;
}
