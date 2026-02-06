import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class RenewLicenseDto {
	@ApiProperty({
		description: 'Número de dias para renovar a licença',
		minimum: 1,
	})
	@IsInt()
	@Min(1)
	@IsNotEmpty()
	durationDays: number;
}
