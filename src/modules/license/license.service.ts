import {
	Injectable,
	NotFoundException,
	BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import * as crypto from 'crypto';

export interface LicensePaginationParams {
	page?: number;
	limit?: number;
	search?: string;
	isActive?: boolean;
	organizationId?: string;
	licenseTypeId?: string;
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

export interface LicenseValidationResult {
	isValid: boolean;
	license?: any;
	reason?: string;
}

@Injectable()
export class LicenseService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Generates a secure, unique license key
	 */
	generateLicenseKey(): string {
		const part1 = crypto.randomBytes(4).toString('hex').toUpperCase();
		const part2 = crypto.randomBytes(4).toString('hex').toUpperCase();
		const part3 = crypto.randomBytes(4).toString('hex').toUpperCase();
		const part4 = crypto.randomBytes(4).toString('hex').toUpperCase();
		return `LIC-${part1}-${part2}-${part3}-${part4}`;
	}

	async create(data: CreateLicenseDto) {
		const key = this.generateLicenseKey();

		// Verify organization exists
		const organization = await this.prisma.organization.findUnique({
			where: { id: data.organizationId },
		});
		if (!organization) {
			throw new BadRequestException('Organização não encontrada');
		}

		// Verify license type exists
		const licenseType = await this.prisma.licenseType.findUnique({
			where: { id: data.licenseTypeId },
		});
		if (!licenseType) {
			throw new BadRequestException('Tipo de licença não encontrado');
		}

		// Calculate expiration if duration is set on license type
		let expiresAt = data.expiresAt;
		if (!expiresAt && licenseType.duration > 0) {
			expiresAt = new Date(
				Date.now() + licenseType.duration * 24 * 60 * 60 * 1000,
			);
		}

		return this.prisma.license.create({
			data: {
				name: data.name,
				organizationId: data.organizationId,
				licenseTypeId: data.licenseTypeId,
				description: data.description,
				features: data.features,
				isActive: data.isActive ?? true,
				key,
				expiresAt,
			},
			include: {
				organization: true,
				licenseType: true,
			},
		});
	}

	async findAll(
		params: LicensePaginationParams = {},
	): Promise<PaginatedResult<any>> {
		const {
			page = 1,
			limit = 10,
			search,
			isActive,
			organizationId,
			licenseTypeId,
		} = params;
		const skip = (page - 1) * limit;

		const where: any = {
			deletedAt: null,
		};

		if (isActive !== undefined) {
			where.isActive = isActive;
		}

		if (organizationId) {
			where.organizationId = organizationId;
		}

		if (licenseTypeId) {
			where.licenseTypeId = licenseTypeId;
		}

		if (search) {
			where.OR = [
				{ name: { contains: search, mode: 'insensitive' } },
				{ description: { contains: search, mode: 'insensitive' } },
				{ key: { contains: search, mode: 'insensitive' } },
			];
		}

		const [data, total] = await Promise.all([
			this.prisma.license.findMany({
				where,
				skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
				include: {
					organization: true,
					licenseType: true,
					_count: {
						select: { seats: true },
					},
				},
			}),
			this.prisma.license.count({ where }),
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
		const license = await this.prisma.license.findFirst({
			where: { id, deletedAt: null },
			include: {
				organization: true,
				licenseType: true,
				seats: {
					where: { deletedAt: null },
					include: {
						user: true,
					},
				},
			},
		});

		if (!license) {
			throw new NotFoundException('Licença não encontrada');
		}

		return license;
	}

	async findByKey(key: string) {
		return this.prisma.license.findFirst({
			where: { key, deletedAt: null },
			include: {
				organization: true,
				licenseType: true,
			},
		});
	}

	async findByOrganization(
		organizationId: string,
		params: LicensePaginationParams = {},
	): Promise<PaginatedResult<any>> {
		return this.findAll({ ...params, organizationId });
	}

	async update(id: string, data: UpdateLicenseDto) {
		await this.findById(id);

		return this.prisma.license.update({
			where: { id },
			data: {
				name: data.name,
				description: data.description,
				features: data.features,
				isActive: data.isActive,
				expiresAt: data.expiresAt,
			},
			include: {
				organization: true,
				licenseType: true,
			},
		});
	}

	async delete(id: string) {
		await this.findById(id);

		return this.prisma.license.update({
			where: { id },
			data: {
				deletedAt: new Date(),
				isActive: false,
			},
		});
	}

	async validateLicenseKey(key: string): Promise<LicenseValidationResult> {
		const license = await this.prisma.license.findUnique({
			where: { key },
			include: {
				organization: true,
				licenseType: true,
				_count: {
					select: { seats: true },
				},
			},
		});

		if (!license) {
			return {
				isValid: false,
				reason: 'Licença não encontrada',
			};
		}

		if (license.deletedAt) {
			return {
				isValid: false,
				reason: 'Licença foi removida',
			};
		}

		if (!license.isActive) {
			return {
				isValid: false,
				reason: 'Licença está inativa',
			};
		}

		if (!license.organization.isActive) {
			return {
				isValid: false,
				reason: 'Organização está inativa',
			};
		}

		if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
			return {
				isValid: false,
				reason: 'Licença expirada',
				license: {
					id: license.id,
					name: license.name,
					expiresAt: license.expiresAt,
				},
			};
		}

		// Remove key from response
		const { key: _, ...safeData } = license;

		return {
			isValid: true,
			license: {
				...safeData,
				seatsUsed: license._count.seats,
				seatsAvailable: license.licenseType.maxSeats
					? license.licenseType.maxSeats - license._count.seats
					: null,
			},
		};
	}

	async renewLicense(id: string, durationDays: number) {
		const license = await this.findById(id);

		const currentExpiry = license.expiresAt
			? new Date(license.expiresAt)
			: new Date();
		const newExpiry = new Date(
			currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000,
		);

		return this.prisma.license.update({
			where: { id },
			data: {
				expiresAt: newExpiry,
				isActive: true,
			},
			include: {
				organization: true,
				licenseType: true,
			},
		});
	}
}
