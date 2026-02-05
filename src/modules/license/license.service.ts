import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateLicenseDto } from './dto/create-license.dto';

@Injectable()
export class LicenseService {
	constructor(private readonly prisma: PrismaService) {}

	async create(data: CreateLicenseDto) {
		return this.prisma.license.create({ data });
	}

	async findAll() {
		return this.prisma.license.findMany();
	}

	async findById(id: string) {
		return this.prisma.license.findUnique({ where: { id } });
	}

	async update(id: string, data: CreateLicenseDto) {
		return this.prisma.license.update({ where: { id }, data });
	}

	async delete(id: string) {
		return this.prisma.license.update({
			where: { id },
			data: { deletedAt: new Date(), isActive: false },
		});
	}
}
