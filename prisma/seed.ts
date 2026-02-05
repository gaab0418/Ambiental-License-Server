import 'dotenv/config';
import { CreateLicenseDto } from 'src/modules/license/dto/create-license.dto';
import { CreateLicenseTypeDto } from 'src/modules/license/dto/create-license-type.dto';
import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { CreateUserDto } from 'src/modules/users/dto/create-user.dto';

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });
async function main() {
	console.log('Database Seeding...');

	const userData: CreateUserDto = {
		email: 'admin@admin.local',
		name: 'Admin',
		password:
			'$2b$12$eTMY/pyy6ZAe8tnm0xVOk.PSllKnOFafgKaQroYarfEGosQefxFim',
	};

	const user = await prisma.user.upsert({
		where: {
			email: 'admin@admin.local',
		},
		update: { ...userData, role: 'ADMIN', isActive: true },
		create: { ...userData, role: 'ADMIN', isActive: true },
	});

	const licenseTypeData: CreateLicenseTypeDto = {
		name: 'Default',
		description: 'Licença Default',
		price: 0,
		duration: 0,
		isPerSeat: false,
		maxSeats: 0,
		isActive: true,
	};

	const licenseType = await prisma.licenseType.upsert({
		where: {
			name: 'Default',
		},
		update: licenseTypeData,
		create: licenseTypeData,
	});

	const licenseData: CreateLicenseDto = {
		name: 'Default',
		ownerId: user.id,
		key: 'ABC',
		description: 'Licença Default',
		licenseTypeId: licenseType.id,
		isActive: true,
	};

	const license = await prisma.license.upsert({
		where: {
			key: 'ABC',
		},
		update: licenseData,
		create: licenseData,
	});

	console.log('Database Seeded');
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
