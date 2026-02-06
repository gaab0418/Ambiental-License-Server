import { Test, TestingModule } from '@nestjs/testing';
import { LicenseController } from './license.controller';
import { LicenseService } from './license.service';

const mockLicenseService = {
	create: jest.fn(),
	findAll: jest.fn(),
	findById: jest.fn(),
	findByKey: jest.fn(),
	findByOrganization: jest.fn(),
	update: jest.fn(),
	delete: jest.fn(),
	validateLicenseKey: jest.fn(),
	renew: jest.fn(),
};

describe('LicenseController', () => {
	let controller: LicenseController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [LicenseController],
			providers: [
				{ provide: LicenseService, useValue: mockLicenseService },
			],
		}).compile();

		controller = module.get<LicenseController>(LicenseController);
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
