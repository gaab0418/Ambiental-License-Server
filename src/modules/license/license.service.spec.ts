import { Test, TestingModule } from '@nestjs/testing';
import { LicenseService } from './license.service';
import { PrismaService } from '../../shared/prisma/prisma.service';

const mockPrismaService = {
	license: {
		create: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		count: jest.fn(),
	},
	organization: {
		findUnique: jest.fn(),
	},
	licenseType: {
		findFirst: jest.fn(),
	},
};

describe('LicenseService', () => {
	let service: LicenseService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				LicenseService,
				{ provide: PrismaService, useValue: mockPrismaService },
			],
		}).compile();

		service = module.get<LicenseService>(LicenseService);
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
