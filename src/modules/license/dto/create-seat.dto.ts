import {
	IsBoolean,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
} from 'class-validator';

export class CreateSeatDto {
	@IsString()
	@IsNotEmpty()
	licenseId: string;

	@IsString()
	@IsNotEmpty()
	userId: string;

	@IsInt()
	@IsNotEmpty()
	duration: number;

	@IsBoolean()
	@IsOptional()
	isActive?: boolean;
}
