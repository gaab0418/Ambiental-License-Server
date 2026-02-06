import { Test, TestingModule } from '@nestjs/testing';
import { LicenseService } from './license.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrismaService = {
	license: {
		create: jest.fn(),
		findFirst: jest.fn(),
		findMany: jest.fn(),
		findUnique: jest.fn(),
		update: jest.fn(),
		count: jest.fn(),
	},
	organization: {
		findUnique: jest.fn(),
	},
	licenseType: {
		findUnique: jest.fn(),
	},
};

describe('LicenseService', () => {
	let service: LicenseService;

	const mockOrganization = {
		id: 'org-123',
		name: 'Test Org',
		slug: 'test-org',
		isActive: true,
	};

	const mockLicenseType = {
		id: 'type-123',
		name: 'Professional',
		duration: 30,
		isPerSeat: true,
		maxSeats: 5,
		isActive: true,
	};

	const mockLicense = {
		id: 'license-123',
		name: 'Test License',
		key: 'LIC-TEST-1234-5678-ABCD',
		organizationId: 'org-123',
		licenseTypeId: 'type-123',
		isActive: true,
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		deletedAt: null,
		organization: mockOrganization,
		licenseType: mockLicenseType,
		_count: { seats: 2 },
	};

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

	// ==================== generateLicenseKey ====================
	describe('generateLicenseKey', () => {
		it('deve gerar uma chave no formato LIC-XXXX-XXXX-XXXX-XXXX', () => {
			const key = service.generateLicenseKey();

			expect(key).toMatch(
				/^LIC-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/,
			);
		});

		it('deve gerar chaves únicas', () => {
			const key1 = service.generateLicenseKey();
			const key2 = service.generateLicenseKey();

			expect(key1).not.toBe(key2);
		});
	});

	// ==================== create ====================
	describe('create', () => {
		const createDto = {
			name: 'Nova Licença',
			organizationId: 'org-123',
			licenseTypeId: 'type-123',
			description: 'Descrição',
		};

		it('deve criar uma licença com sucesso', async () => {
			mockPrismaService.organization.findUnique.mockResolvedValue(
				mockOrganization,
			);
			mockPrismaService.licenseType.findUnique.mockResolvedValue(
				mockLicenseType,
			);
			mockPrismaService.license.create.mockResolvedValue(mockLicense);

			const result = await service.create(createDto);

			expect(result).toEqual(mockLicense);
			expect(mockPrismaService.license.create).toHaveBeenCalled();
		});

		it('deve lançar BadRequestException se organização não existe', async () => {
			mockPrismaService.organization.findUnique.mockResolvedValue(null);

			await expect(service.create(createDto)).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.create(createDto)).rejects.toThrow(
				'Organização não encontrada',
			);
		});

		it('deve lançar BadRequestException se tipo de licença não existe', async () => {
			mockPrismaService.organization.findUnique.mockResolvedValue(
				mockOrganization,
			);
			mockPrismaService.licenseType.findUnique.mockResolvedValue(null);

			await expect(service.create(createDto)).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.create(createDto)).rejects.toThrow(
				'Tipo de licença não encontrado',
			);
		});

		it('deve calcular expiresAt automaticamente baseado na duration do licenseType', async () => {
			mockPrismaService.organization.findUnique.mockResolvedValue(
				mockOrganization,
			);
			mockPrismaService.licenseType.findUnique.mockResolvedValue(
				mockLicenseType,
			);
			mockPrismaService.license.create.mockResolvedValue(mockLicense);

			await service.create(createDto);

			const createCall =
				mockPrismaService.license.create.mock.calls[0][0];
			expect(createCall.data.expiresAt).toBeDefined();
		});
	});

	// ==================== findAll ====================
	describe('findAll', () => {
		it('deve retornar lista paginada de licenças', async () => {
			mockPrismaService.license.findMany.mockResolvedValue([mockLicense]);
			mockPrismaService.license.count.mockResolvedValue(1);

			const result = await service.findAll();

			expect(result.data).toHaveLength(1);
			expect(result.meta.total).toBe(1);
			expect(result.meta.page).toBe(1);
			expect(result.meta.limit).toBe(10);
		});

		it('deve filtrar por isActive', async () => {
			mockPrismaService.license.findMany.mockResolvedValue([mockLicense]);
			mockPrismaService.license.count.mockResolvedValue(1);

			await service.findAll({ isActive: true });

			const findCall =
				mockPrismaService.license.findMany.mock.calls[0][0];
			expect(findCall.where.isActive).toBe(true);
		});

		it('deve filtrar por organizationId', async () => {
			mockPrismaService.license.findMany.mockResolvedValue([mockLicense]);
			mockPrismaService.license.count.mockResolvedValue(1);

			await service.findAll({ organizationId: 'org-123' });

			const findCall =
				mockPrismaService.license.findMany.mock.calls[0][0];
			expect(findCall.where.organizationId).toBe('org-123');
		});

		it('deve filtrar por licenseTypeId', async () => {
			mockPrismaService.license.findMany.mockResolvedValue([mockLicense]);
			mockPrismaService.license.count.mockResolvedValue(1);

			await service.findAll({ licenseTypeId: 'type-123' });

			const findCall =
				mockPrismaService.license.findMany.mock.calls[0][0];
			expect(findCall.where.licenseTypeId).toBe('type-123');
		});

		it('deve aplicar busca textual', async () => {
			mockPrismaService.license.findMany.mockResolvedValue([]);
			mockPrismaService.license.count.mockResolvedValue(0);

			await service.findAll({ search: 'test' });

			const findCall =
				mockPrismaService.license.findMany.mock.calls[0][0];
			expect(findCall.where.OR).toBeDefined();
			expect(findCall.where.OR).toHaveLength(3);
		});

		it('deve aplicar paginação corretamente', async () => {
			mockPrismaService.license.findMany.mockResolvedValue([]);
			mockPrismaService.license.count.mockResolvedValue(25);

			const result = await service.findAll({ page: 2, limit: 5 });

			const findCall =
				mockPrismaService.license.findMany.mock.calls[0][0];
			expect(findCall.skip).toBe(5);
			expect(findCall.take).toBe(5);
			expect(result.meta.totalPages).toBe(5);
		});
	});

	// ==================== findById ====================
	describe('findById', () => {
		it('deve retornar licença por ID', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue(mockLicense);

			const result = await service.findById('license-123');

			expect(result).toEqual(mockLicense);
		});

		it('deve lançar NotFoundException se licença não existe', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue(null);

			await expect(service.findById('invalid-id')).rejects.toThrow(
				NotFoundException,
			);
			await expect(service.findById('invalid-id')).rejects.toThrow(
				'Licença não encontrada',
			);
		});
	});

	// ==================== findByKey ====================
	describe('findByKey', () => {
		it('deve retornar licença por key', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue(mockLicense);

			const result = await service.findByKey('LIC-TEST-1234-5678-ABCD');

			expect(result).toEqual(mockLicense);
		});

		it('deve retornar null se key não existe', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue(null);

			const result = await service.findByKey('INVALID-KEY');

			expect(result).toBeNull();
		});
	});

	// ==================== findByOrganization ====================
	describe('findByOrganization', () => {
		it('deve chamar findAll com organizationId', async () => {
			mockPrismaService.license.findMany.mockResolvedValue([mockLicense]);
			mockPrismaService.license.count.mockResolvedValue(1);

			const result = await service.findByOrganization('org-123');

			expect(result.data).toHaveLength(1);
			const findCall =
				mockPrismaService.license.findMany.mock.calls[0][0];
			expect(findCall.where.organizationId).toBe('org-123');
		});
	});

	// ==================== update ====================
	describe('update', () => {
		it('deve atualizar licença com sucesso', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue(mockLicense);
			mockPrismaService.license.update.mockResolvedValue({
				...mockLicense,
				name: 'Updated Name',
			});

			const result = await service.update('license-123', {
				name: 'Updated Name',
			});

			expect(result.name).toBe('Updated Name');
			expect(mockPrismaService.license.update).toHaveBeenCalledWith({
				where: { id: 'license-123' },
				data: expect.objectContaining({ name: 'Updated Name' }),
				include: expect.any(Object),
			});
		});

		it('deve lançar NotFoundException se licença não existe', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue(null);

			await expect(
				service.update('invalid-id', { name: 'Test' }),
			).rejects.toThrow(NotFoundException);
		});
	});

	// ==================== delete ====================
	describe('delete', () => {
		it('deve fazer soft delete da licença', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue(mockLicense);
			mockPrismaService.license.update.mockResolvedValue({
				...mockLicense,
				deletedAt: new Date(),
				isActive: false,
			});

			await service.delete('license-123');

			expect(mockPrismaService.license.update).toHaveBeenCalledWith({
				where: { id: 'license-123' },
				data: {
					deletedAt: expect.any(Date),
					isActive: false,
				},
			});
		});

		it('deve lançar NotFoundException se licença não existe', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue(null);

			await expect(service.delete('invalid-id')).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	// ==================== validateLicenseKey ====================
	describe('validateLicenseKey', () => {
		it('deve retornar isValid: true para licença válida', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(mockLicense);

			const result = await service.validateLicenseKey(
				'LIC-TEST-1234-5678-ABCD',
			);

			expect(result.isValid).toBe(true);
			expect(result.license).toBeDefined();
		});

		it('deve retornar isValid: false se licença não existe', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(null);

			const result = await service.validateLicenseKey('INVALID-KEY');

			expect(result.isValid).toBe(false);
			expect(result.reason).toBe('Licença não encontrada');
		});

		it('deve retornar isValid: false se licença foi deletada', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue({
				...mockLicense,
				deletedAt: new Date(),
			});

			const result = await service.validateLicenseKey(
				'LIC-TEST-1234-5678-ABCD',
			);

			expect(result.isValid).toBe(false);
			expect(result.reason).toBe('Licença foi removida');
		});

		it('deve retornar isValid: false se licença está inativa', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue({
				...mockLicense,
				isActive: false,
			});

			const result = await service.validateLicenseKey(
				'LIC-TEST-1234-5678-ABCD',
			);

			expect(result.isValid).toBe(false);
			expect(result.reason).toBe('Licença está inativa');
		});

		it('deve retornar isValid: false se organização está inativa', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue({
				...mockLicense,
				organization: { ...mockOrganization, isActive: false },
			});

			const result = await service.validateLicenseKey(
				'LIC-TEST-1234-5678-ABCD',
			);

			expect(result.isValid).toBe(false);
			expect(result.reason).toBe('Organização está inativa');
		});

		it('deve retornar isValid: false se licença expirou', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue({
				...mockLicense,
				expiresAt: new Date(Date.now() - 86400000), // ontem
			});

			const result = await service.validateLicenseKey(
				'LIC-TEST-1234-5678-ABCD',
			);

			expect(result.isValid).toBe(false);
			expect(result.reason).toBe('Licença expirada');
		});

		it('deve calcular seats disponíveis corretamente', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(mockLicense);

			const result = await service.validateLicenseKey(
				'LIC-TEST-1234-5678-ABCD',
			);

			expect(result.license.seatsUsed).toBe(2);
			expect(result.license.seatsAvailable).toBe(3); // maxSeats(5) - used(2)
		});
	});

	// ==================== renewLicense ====================
	describe('renewLicense', () => {
		it('deve renovar licença por N dias', async () => {
			const currentExpiry = new Date();
			mockPrismaService.license.findFirst.mockResolvedValue({
				...mockLicense,
				expiresAt: currentExpiry,
			});
			mockPrismaService.license.update.mockResolvedValue({
				...mockLicense,
			});

			await service.renewLicense('license-123', 30);

			const updateCall =
				mockPrismaService.license.update.mock.calls[0][0];
			const newExpiry = updateCall.data.expiresAt;
			const expectedExpiry = new Date(
				currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000,
			);

			expect(newExpiry.getTime()).toBeCloseTo(
				expectedExpiry.getTime(),
				-2,
			);
			expect(updateCall.data.isActive).toBe(true);
		});

		it('deve usar data atual se licença não tem expiresAt', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue({
				...mockLicense,
				expiresAt: null,
			});
			mockPrismaService.license.update.mockResolvedValue({
				...mockLicense,
			});

			await service.renewLicense('license-123', 30);

			const updateCall =
				mockPrismaService.license.update.mock.calls[0][0];
			expect(updateCall.data.expiresAt).toBeDefined();
		});

		it('deve lançar NotFoundException se licença não existe', async () => {
			mockPrismaService.license.findFirst.mockResolvedValue(null);

			await expect(
				service.renewLicense('invalid-id', 30),
			).rejects.toThrow(NotFoundException);
		});
	});
});
