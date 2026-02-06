import { Module } from '@nestjs/common';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { LicenseTypeService } from './license-type.service';
import { LicenseTypeController } from './license-type.controller';
import { SeatService } from './seat.service';
import { SeatController, MySeatController } from './seat.controller';

@Module({
	providers: [LicenseService, LicenseTypeService, SeatService],
	controllers: [
		LicenseController,
		LicenseTypeController,
		SeatController,
		MySeatController,
	],
	exports: [LicenseService, LicenseTypeService, SeatService],
})
export class LicenseModule {}
