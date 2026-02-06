import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';

describe('LicenseController (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;

	let userToken: string;
	let adminToken: string;

	let testOrganizationId: string;
	let testLicenseTypeId: string;
	let createdLicenseId: string;
	let createdLicenseKey: string;

	const testLicense = {
		name: `Test-License-${Date.now()}`,
		description: 'Licença para testes E2E',
		isActive: true,
		features: { aiTokenLimit: 5000, customFeature: true },
	};

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(
			new ValidationPipe({
				whitelist: true,
				forbidNonWhitelisted: true,
				transform: true,
			}),
		);
		app.setGlobalPrefix('api/v1');

		await app.init();

		prisma = app.get(PrismaService);

		// Login como ADMIN
		const adminLogin = await request(app.getHttpServer())
			.post('/api/v1/auth/login')
			.send({
				email: 'admin@admin.local',
				password: 'admin123',
			});

		if (adminLogin.status === 201) {
			adminToken = adminLogin.body.access_token;
		}

		// Criar usuário normal
		const userEmail = `license-test-${Date.now()}@example.com`;
		const registerRes = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send({
				email: userEmail,
				password: 'SecurePass@123',
				name: 'License Test User',
			});

		if (registerRes.status === 201) {
			userToken = registerRes.body.access_token;
		}

		// Buscar organização e tipo de licença do seed
		const org = await prisma.organization.findFirst();
		if (org) testOrganizationId = org.id;

		const licenseType = await prisma.licenseType.findFirst({
			where: { isActive: true, deletedAt: null },
		});
		if (licenseType) testLicenseTypeId = licenseType.id;
	});

	afterAll(async () => {
		// Limpar licenças de teste
		if (createdLicenseId) {
			await prisma.license
				.delete({
					where: { id: createdLicenseId },
				})
				.catch(() => {});
		}

		// Limpar usuários de teste
		await prisma.user.deleteMany({
			where: { email: { contains: 'license-test-' } },
		});

		await app.close();
	});

	// ==================== VALIDAÇÃO PÚBLICA ====================

	describe('POST /api/v1/licenses/validate (Public)', () => {
		it('deve validar licença por key (licença existente do seed)', async () => {
			const seedLicense = await prisma.license.findFirst({
				where: { isActive: true, deletedAt: null },
			});

			if (!seedLicense) {
				console.warn('Skipping: no seed license found');
				return;
			}

			const response = await request(app.getHttpServer())
				.post('/api/v1/licenses/validate')
				.send({ key: seedLicense.key })
				.expect(200);

			expect(response.body).toHaveProperty('isValid');
		});

		it('deve retornar inválido para key inexistente', async () => {
			const response = await request(app.getHttpServer())
				.post('/api/v1/licenses/validate')
				.send({ key: 'INVALID-KEY-0000-0000' })
				.expect(200);

			expect(response.body.isValid).toBe(false);
			expect(response.body.reason).toContain('não encontrada');
		});

		it('deve retornar 400 sem key', async () => {
			await request(app.getHttpServer())
				.post('/api/v1/licenses/validate')
				.send({})
				.expect(400);
		});
	});

	// ==================== ENDPOINTS DO USUÁRIO ====================

	describe('GET /api/v1/licenses/my (User)', () => {
		it('deve retornar 401 sem autenticação', async () => {
			await request(app.getHttpServer())
				.get('/api/v1/licenses/my')
				.expect(401);
		});

		it('deve listar licenças da organização do usuário', async () => {
			if (!userToken) return;

			const response = await request(app.getHttpServer())
				.get('/api/v1/licenses/my')
				.set('Authorization', `Bearer ${userToken}`)
				.expect(200);

			expect(response.body).toHaveProperty('data');
			expect(Array.isArray(response.body.data)).toBe(true);
		});
	});

	// ==================== ENDPOINTS ADMIN - CRUD ====================

	describe('POST /api/v1/licenses (Admin only)', () => {
		it('deve retornar 401 sem autenticação', async () => {
			await request(app.getHttpServer())
				.post('/api/v1/licenses')
				.send(testLicense)
				.expect(401);
		});

		it('deve retornar 403 para usuário comum', async () => {
			if (!userToken) return;

			await request(app.getHttpServer())
				.post('/api/v1/licenses')
				.set('Authorization', `Bearer ${userToken}`)
				.send({
					...testLicense,
					organizationId: testOrganizationId,
					licenseTypeId: testLicenseTypeId,
				})
				.expect(403);
		});

		it('deve criar licença com key auto-gerado como ADMIN', async () => {
			if (!adminToken || !testOrganizationId || !testLicenseTypeId) {
				console.warn('Skipping: required data not available');
				return;
			}

			const response = await request(app.getHttpServer())
				.post('/api/v1/licenses')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					...testLicense,
					organizationId: testOrganizationId,
					licenseTypeId: testLicenseTypeId,
				})
				.expect(201);

			expect(response.body).toHaveProperty('id');
			expect(response.body).toHaveProperty('key');
			expect(response.body.key).toMatch(
				/^LIC-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/,
			);
			expect(response.body.name).toBe(testLicense.name);
			expect(response.body.features).toEqual(testLicense.features);

			createdLicenseId = response.body.id;
			createdLicenseKey = response.body.key;
		});

		it('deve retornar 400 para organização inexistente', async () => {
			if (!adminToken) return;

			await request(app.getHttpServer())
				.post('/api/v1/licenses')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					...testLicense,
					organizationId: '00000000-0000-0000-0000-000000000000',
					licenseTypeId: testLicenseTypeId,
				})
				.expect(400);
		});
	});

	describe('GET /api/v1/licenses (Admin only)', () => {
		it('deve retornar 401 sem autenticação', async () => {
			await request(app.getHttpServer())
				.get('/api/v1/licenses')
				.expect(401);
		});

		it('deve listar licenças paginadas como ADMIN', async () => {
			if (!adminToken) return;

			const response = await request(app.getHttpServer())
				.get('/api/v1/licenses')
				.set('Authorization', `Bearer ${adminToken}`)
				.query({ page: 1, limit: 10 })
				.expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body).toHaveProperty('meta');
			expect(Array.isArray(response.body.data)).toBe(true);
		});

		it('deve filtrar por organizationId', async () => {
			if (!adminToken || !testOrganizationId) return;

			const response = await request(app.getHttpServer())
				.get('/api/v1/licenses')
				.set('Authorization', `Bearer ${adminToken}`)
				.query({ organizationId: testOrganizationId })
				.expect(200);

			response.body.data.forEach((license: any) => {
				expect(license.organizationId).toBe(testOrganizationId);
			});
		});
	});

	describe('GET /api/v1/licenses/:id (Admin only)', () => {
		it('deve buscar licença por ID com seats', async () => {
			if (!adminToken || !createdLicenseId) return;

			const response = await request(app.getHttpServer())
				.get(`/api/v1/licenses/${createdLicenseId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.id).toBe(createdLicenseId);
			expect(response.body).toHaveProperty('seats');
			expect(response.body).toHaveProperty('organization');
			expect(response.body).toHaveProperty('licenseType');
		});

		it('deve retornar 404 para ID inexistente', async () => {
			if (!adminToken) return;

			await request(app.getHttpServer())
				.get('/api/v1/licenses/00000000-0000-0000-0000-000000000000')
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(404);
		});
	});

	describe('PUT /api/v1/licenses/:id (Admin only)', () => {
		it('deve atualizar licença', async () => {
			if (!adminToken || !createdLicenseId) return;

			const updateData = {
				description: 'Descrição atualizada via E2E test',
				features: { aiTokenLimit: 10000 },
			};

			const response = await request(app.getHttpServer())
				.put(`/api/v1/licenses/${createdLicenseId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send(updateData)
				.expect(200);

			expect(response.body.description).toBe(updateData.description);
			expect(response.body.features).toEqual(updateData.features);
		});
	});

	describe('POST /api/v1/licenses/:id/renew (Admin only)', () => {
		it('deve renovar licença por X dias', async () => {
			if (!adminToken || !createdLicenseId) return;

			const beforeRenew = await request(app.getHttpServer())
				.get(`/api/v1/licenses/${createdLicenseId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			const response = await request(app.getHttpServer())
				.post(`/api/v1/licenses/${createdLicenseId}/renew`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ durationDays: 30 })
				.expect(201);

			expect(response.body.expiresAt).not.toBeNull();
			expect(response.body.isActive).toBe(true);

			// Verificar que a data de expiração aumentou
			if (beforeRenew.body.expiresAt) {
				const oldDate = new Date(beforeRenew.body.expiresAt);
				const newDate = new Date(response.body.expiresAt);
				expect(newDate.getTime()).toBeGreaterThan(oldDate.getTime());
			}
		});

		it('deve retornar 400 sem durationDays', async () => {
			if (!adminToken || !createdLicenseId) return;

			await request(app.getHttpServer())
				.post(`/api/v1/licenses/${createdLicenseId}/renew`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({})
				.expect(400);
		});
	});

	describe('DELETE /api/v1/licenses/:id (Admin only)', () => {
		it('deve fazer soft delete da licença', async () => {
			if (!adminToken || !createdLicenseId) return;

			const response = await request(app.getHttpServer())
				.delete(`/api/v1/licenses/${createdLicenseId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.deletedAt).not.toBeNull();
			expect(response.body.isActive).toBe(false);

			// Validação deve retornar removida
			const validateRes = await request(app.getHttpServer())
				.post('/api/v1/licenses/validate')
				.send({ key: createdLicenseKey })
				.expect(200);

			expect(validateRes.body.isValid).toBe(false);
			expect(validateRes.body.reason).toContain('removida');
		});
	});
});
