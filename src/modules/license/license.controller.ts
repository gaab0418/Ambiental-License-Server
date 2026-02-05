import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LicenseService } from './license.service';

@Controller('license')
@UseGuards(JwtAuthGuard)
export class LicenseController {
	constructor(private readonly licenseService: LicenseService) {}

	@Get()
	async findAll() {
		return this.licenseService.findAll();
	}
}
