import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
	connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
	console.log('Database Seeding...');

	// 1. Create Organization
	const organization = await prisma.organization.upsert({
		where: { slug: 'system-org' },
		update: {},
		create: {
			name: 'System',
			slug: 'system-org',
			description: 'Organização padrão do sistema',
			isActive: true,
		},
	});
	console.log('Organization:', organization.name);

	// 2. Create Admin User (ID 1)
	const adminUser = await prisma.user.upsert({
		where: { email: 'admin@ambiental.local' },
		update: {
			role: 'SYSTEM',
			isActive: true,
			organizationId: organization.id,
			isOrgLeader: true,
		},
		create: {
			email: 'admin@ambiental.local',
			name: 'Admin',
			password:
				'$2b$12$eTMY/pyy6ZAe8tnm0xVOk.PSllKnOFafgKaQroYarfEGosQefxFim', // admin123
			role: 'SYSTEM',
			isActive: true,
			organizationId: organization.id,
			isOrgLeader: true,
		},
	});
	console.log('Admin User:', adminUser.email);

	// 3. Create License Type
	const licenseType = await prisma.licenseType.upsert({
		where: { name: 'System Default' },
		update: {},
		create: {
			name: 'System Default',
			description: 'Licença padrão do sistema',
			price: 0,
			duration: 0,
			isPerSeat: true,
			maxSeats: 1,
			isActive: true,
		},
	});
	console.log('LicenseType:', licenseType.name);

	// 4. Create License
	const license = await prisma.license.upsert({
		where: { key: 'LIC-DEFAULT-SYSTEM' },
		update: {},
		create: {
			name: 'System Default',
			key: 'LIC-DEFAULT-SYSTEM',
			description: 'Licença padrão do sistema',
			organizationId: organization.id,
			licenseTypeId: licenseType.id,
			expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
			features: {
				aiTokenLimit: 999999999,
			},
			isActive: true,
		},
	});
	console.log('License:', license.name, '- Key:', license.key);

	console.log('Seed completed!');
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
