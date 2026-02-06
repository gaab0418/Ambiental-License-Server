import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateLicenseTypeDto } from './dto/create-license-type.dto';
import { UpdateLicenseTypeDto } from './dto/update-license-type.dto';

export interface PaginationParams {
	page?: number;
	limit?: number;
	search?: string;
	isActive?: boolean;
}

export interface PaginatedResult<T> {
	data: T[];
	meta: {
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	};
}

@Injectable()
export class LicenseTypeService {
	constructor(private readonly prisma: PrismaService) {}

	async create(data: CreateLicenseTypeDto) {
		return this.prisma.licenseType.create({ data });
	}

	async findAll(
		params: PaginationParams = {},
	): Promise<PaginatedResult<any>> {
		const { page = 1, limit = 10, search, isActive } = params;
		const skip = (page - 1) * limit;

		const where: any = {
			deletedAt: null,
		};

		if (isActive !== undefined) {
			where.isActive = isActive;
		}

		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
			];
		}

		const [data, total] = await Promise.all([
			this.prisma.licenseType.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.licenseType.count({ where }),
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
		const licenseType = await this.prisma.licenseType.findUnique({
			where: { id, deletedAt: null },
		});

		if (!licenseType) {
			throw new NotFoundException('Tipo de licença não encontrado');
		}

		return licenseType;
	}

	async findByName(name: string) {
		return this.prisma.licenseType.findFirst({
			where: { name, deletedAt: null },
		});
	}

	async update(id: string, data: UpdateLicenseTypeDto) {
		await this.findById(id); // Ensure exists

		return this.prisma.licenseType.update({
			where: { id },
			data,
		});
	}

	async delete(id: string) {
		await this.findById(id); // Ensure exists

		return this.prisma.licenseType.update({
			where: { id },
			data: {
				deletedAt: new Date(),
				isActive: false,
			},
		});
	}

	async findActiveTypes() {
		return this.prisma.licenseType.findMany({
			where: { isActive: true, deletedAt: null },
			orderBy: { price: 'asc' },
		});
	}
}
