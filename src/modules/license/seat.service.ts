import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateSeatDto } from './dto/create-seat.dto';
import { SeatAllocationCode } from './license.enums';
import {
	SeatAllocationResult,
	SeatPaginationParams,
	PaginatedResult,
} from './license.interfaces';

@Injectable()
export class SeatService {
	constructor(private readonly prisma: PrismaService) {}

	async allocate(data: CreateSeatDto): Promise<SeatAllocationResult> {
		// Verify license exists
		const license = await this.prisma.license.findUnique({
			where: { id: data.licenseId },
			include: {
				licenseType: true,
				_count: { select: { seats: { where: { deletedAt: null } } } },
			},
		});

		if (!license) {
			return {
				success: false,
				reason: 'Licença não encontrada',
				code: SeatAllocationCode.LICENSE_NOT_FOUND,
			};
		}

		if (license.deletedAt) {
			return {
				success: false,
				reason: 'Licença foi removida',
				code: SeatAllocationCode.LICENSE_DELETED,
			};
		}

		if (!license.isActive) {
			return {
				success: false,
				reason: 'Licença está inativa',
				code: SeatAllocationCode.LICENSE_INACTIVE,
			};
		}

		// Check if license is expired
		if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
			return {
				success: false,
				reason: 'Licença expirada',
				code: SeatAllocationCode.LICENSE_EXPIRED,
			};
		}

		// Check seat limit if applicable
		if (license.licenseType.isPerSeat && license.licenseType.maxSeats) {
			if (license._count.seats >= license.licenseType.maxSeats) {
				return {
					success: false,
					reason: `Limite de seats atingido (${license.licenseType.maxSeats})`,
					code: SeatAllocationCode.LICENSE_SEATS_EXCEEDED,
				};
			}
		}

		// Verify user exists
		const user = await this.prisma.user.findUnique({
			where: { id: data.userId },
		});

		if (!user) {
			return {
				success: false,
				reason: 'Usuário não encontrado',
				code: SeatAllocationCode.SEAT_USER_NOT_FOUND,
			};
		}

		// Check if user already has a seat in this license
		const existingSeat = await this.prisma.seat.findFirst({
			where: {
				licenseId: data.licenseId,
				userId: data.userId,
				deletedAt: null,
			},
		});

		if (existingSeat) {
			return {
				success: false,
				reason: 'Usuário já possui um seat nesta licença',
				code: SeatAllocationCode.SEAT_ALREADY_EXISTS,
			};
		}

		const seat = await this.prisma.seat.create({
			data: {
				licenseId: data.licenseId!,
				userId: data.userId,
				duration: data.duration,
				isActive: data.isActive ?? true,
			},
			include: {
				user: {
					select: { id: true, name: true, email: true },
				},
				license: {
					select: { id: true, name: true, key: true },
				},
			},
		});

		return {
			success: true,
			seat,
			code: SeatAllocationCode.SEAT_ALLOCATED,
		};
	}

	async findByLicense(
		licenseId: string,
		params: SeatPaginationParams = {},
	): Promise<PaginatedResult<any>> {
		const { page = 1, limit = 10, isActive } = params;
		const skip = (page - 1) * limit;

		// Verify license exists
		const license = await this.prisma.license.findUnique({
			where: { id: licenseId, deletedAt: null },
		});

		if (!license) {
			throw new NotFoundException('Licença não encontrada');
		}

		const where: any = {
			licenseId,
			deletedAt: null,
		};

		if (isActive !== undefined) {
			where.isActive = isActive;
		}

		const [data, total] = await Promise.all([
			this.prisma.seat.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
				include: {
					user: {
						select: { id: true, name: true, email: true },
					},
				},
			}),
			this.prisma.seat.count({ where }),
		]);

		return {
			data,
			meta: {
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			},
		};
	}

	async findById(id: string) {
		const seat = await this.prisma.seat.findUnique({
			where: { id, deletedAt: null },
			include: {
				user: {
					select: { id: true, name: true, email: true },
				},
				license: {
					select: { id: true, name: true, key: true },
				},
			},
		});

		if (!seat) {
			throw new NotFoundException('Seat não encontrado');
		}

		return seat;
	}

	async revoke(id: string) {
		await this.findById(id); // Ensure exists

		return this.prisma.seat.update({
			where: { id },
			data: {
				deletedAt: new Date(),
				isActive: false,
			},
		});
	}

	async findByUser(userId: string): Promise<any[]> {
		return this.prisma.seat.findMany({
			where: {
				userId,
				isActive: true,
				deletedAt: null,
			},
			include: {
				license: {
					include: {
						organization: true,
						licenseType: true,
					},
				},
			},
		});
	}
}
