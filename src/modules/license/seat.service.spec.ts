import { Test, TestingModule } from '@nestjs/testing';
import { SeatService } from './seat.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrismaService = {
	license: {
		findUnique: jest.fn(),
	},
	user: {
		findUnique: jest.fn(),
	},
	seat: {
		create: jest.fn(),
		findFirst: jest.fn(),
		findUnique: jest.fn(),
		findMany: jest.fn(),
		update: jest.fn(),
		count: jest.fn(),
	},
};

describe('SeatService', () => {
	let service: SeatService;

	const mockLicenseType = {
		id: 'type-123',
		name: 'Professional',
		isPerSeat: true,
		maxSeats: 5,
	};

	const mockLicense = {
		id: 'license-123',
		name: 'Test License',
		key: 'LIC-TEST-1234',
		isActive: true,
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
		deletedAt: null,
		licenseType: mockLicenseType,
		_count: { seats: 2 },
	};

	const mockUser = {
		id: 'user-123',
		name: 'Test User',
		email: 'test@example.com',
	};

	const mockSeat = {
		id: 'seat-123',
		licenseId: 'license-123',
		userId: 'user-123',
		isActive: true,
		deletedAt: null,
		user: mockUser,
		license: {
			id: 'license-123',
			name: 'Test License',
			key: 'LIC-TEST-1234',
		},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SeatService,
				{ provide: PrismaService, useValue: mockPrismaService },
			],
		}).compile();

		service = module.get<SeatService>(SeatService);
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	// ==================== allocate ====================
	describe('allocate', () => {
		const allocateDto = {
			licenseId: 'license-123',
			userId: 'user-123',
			duration: 30,
		};

		it('deve alocar seat com sucesso', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(mockLicense);
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.seat.findFirst.mockResolvedValue(null);
			mockPrismaService.seat.create.mockResolvedValue(mockSeat);

			const result = await service.allocate(allocateDto);

			expect(result).toEqual(mockSeat);
			expect(mockPrismaService.seat.create).toHaveBeenCalled();
		});

		it('deve lançar NotFoundException se licença não existe', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(null);

			await expect(service.allocate(allocateDto)).rejects.toThrow(
				NotFoundException,
			);
			await expect(service.allocate(allocateDto)).rejects.toThrow(
				'Licença não encontrada',
			);
		});

		it('deve lançar BadRequestException se licença está inativa', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue({
				...mockLicense,
				isActive: false,
			});

			await expect(service.allocate(allocateDto)).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.allocate(allocateDto)).rejects.toThrow(
				'Licença está inativa',
			);
		});

		it('deve lançar BadRequestException se licença expirou', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue({
				...mockLicense,
				expiresAt: new Date(Date.now() - 86400000), // ontem
			});

			await expect(service.allocate(allocateDto)).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.allocate(allocateDto)).rejects.toThrow(
				'Licença expirada',
			);
		});

		it('deve lançar BadRequestException se limite de seats atingido', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue({
				...mockLicense,
				_count: { seats: 5 }, // igual ao maxSeats
			});

			await expect(service.allocate(allocateDto)).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.allocate(allocateDto)).rejects.toThrow(
				'Limite de seats atingido',
			);
		});

		it('deve lançar NotFoundException se usuário não existe', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(mockLicense);
			mockPrismaService.user.findUnique.mockResolvedValue(null);

			await expect(service.allocate(allocateDto)).rejects.toThrow(
				NotFoundException,
			);
			await expect(service.allocate(allocateDto)).rejects.toThrow(
				'Usuário não encontrado',
			);
		});

		it('deve lançar BadRequestException se usuário já tem seat nesta licença', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(mockLicense);
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.seat.findFirst.mockResolvedValue(mockSeat);

			await expect(service.allocate(allocateDto)).rejects.toThrow(
				BadRequestException,
			);
			await expect(service.allocate(allocateDto)).rejects.toThrow(
				'Usuário já possui um seat nesta licença',
			);
		});

		it('deve permitir alocação se licenseType não é per seat', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue({
				...mockLicense,
				licenseType: { ...mockLicenseType, isPerSeat: false },
				_count: { seats: 100 },
			});
			mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
			mockPrismaService.seat.findFirst.mockResolvedValue(null);
			mockPrismaService.seat.create.mockResolvedValue(mockSeat);

			const result = await service.allocate(allocateDto);

			expect(result).toEqual(mockSeat);
		});
	});

	// ==================== findByLicense ====================
	describe('findByLicense', () => {
		it('deve retornar lista paginada de seats', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(mockLicense);
			mockPrismaService.seat.findMany.mockResolvedValue([mockSeat]);
			mockPrismaService.seat.count.mockResolvedValue(1);

			const result = await service.findByLicense('license-123');

			expect(result.data).toHaveLength(1);
			expect(result.meta.total).toBe(1);
			expect(result.meta.page).toBe(1);
		});

		it('deve lançar NotFoundException se licença não existe', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(null);

			await expect(service.findByLicense('invalid-id')).rejects.toThrow(
				NotFoundException,
			);
		});

		it('deve filtrar por isActive', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(mockLicense);
			mockPrismaService.seat.findMany.mockResolvedValue([mockSeat]);
			mockPrismaService.seat.count.mockResolvedValue(1);

			await service.findByLicense('license-123', { isActive: true });

			const findCall = mockPrismaService.seat.findMany.mock.calls[0][0];
			expect(findCall.where.isActive).toBe(true);
		});

		it('deve aplicar paginação corretamente', async () => {
			mockPrismaService.license.findUnique.mockResolvedValue(mockLicense);
			mockPrismaService.seat.findMany.mockResolvedValue([]);
			mockPrismaService.seat.count.mockResolvedValue(15);

			const result = await service.findByLicense('license-123', {
				page: 2,
				limit: 5,
			});

			const findCall = mockPrismaService.seat.findMany.mock.calls[0][0];
			expect(findCall.skip).toBe(5);
			expect(findCall.take).toBe(5);
			expect(result.meta.totalPages).toBe(3);
		});
	});

	// ==================== findById ====================
	describe('findById', () => {
		it('deve retornar seat por ID', async () => {
			mockPrismaService.seat.findUnique.mockResolvedValue(mockSeat);

			const result = await service.findById('seat-123');

			expect(result).toEqual(mockSeat);
		});

		it('deve lançar NotFoundException se seat não existe', async () => {
			mockPrismaService.seat.findUnique.mockResolvedValue(null);

			await expect(service.findById('invalid-id')).rejects.toThrow(
				NotFoundException,
			);
			await expect(service.findById('invalid-id')).rejects.toThrow(
				'Seat não encontrado',
			);
		});
	});

	// ==================== revoke ====================
	describe('revoke', () => {
		it('deve fazer soft delete do seat', async () => {
			mockPrismaService.seat.findUnique.mockResolvedValue(mockSeat);
			mockPrismaService.seat.update.mockResolvedValue({
				...mockSeat,
				deletedAt: new Date(),
				isActive: false,
			});

			await service.revoke('seat-123');

			expect(mockPrismaService.seat.update).toHaveBeenCalledWith({
				where: { id: 'seat-123' },
				data: {
					deletedAt: expect.any(Date),
					isActive: false,
				},
			});
		});

		it('deve lançar NotFoundException se seat não existe', async () => {
			mockPrismaService.seat.findUnique.mockResolvedValue(null);

			await expect(service.revoke('invalid-id')).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	// ==================== findByUser ====================
	describe('findByUser', () => {
		it('deve retornar seats do usuário', async () => {
			mockPrismaService.seat.findMany.mockResolvedValue([mockSeat]);

			const result = await service.findByUser('user-123');

			expect(result).toHaveLength(1);
			expect(mockPrismaService.seat.findMany).toHaveBeenCalledWith({
				where: {
					userId: 'user-123',
					isActive: true,
					deletedAt: null,
				},
				include: expect.any(Object),
			});
		});

		it('deve retornar array vazio se usuário não tem seats', async () => {
			mockPrismaService.seat.findMany.mockResolvedValue([]);

			const result = await service.findByUser('user-123');

			expect(result).toHaveLength(0);
		});
	});
});
