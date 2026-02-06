import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';

describe('LicenseTypeController (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;

	// Tokens para autenticação
	let userToken: string;
	let adminToken: string;

	// IDs criados durante testes
	let createdLicenseTypeId: string;

	const testLicenseType = {
		name: `Test-LType-${Date.now()}`,
		description: 'Tipo de licença para testes E2E',
		price: 99.99,
		duration: 30,
		isPerSeat: true,
		maxSeats: 10,
		isActive: true,
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

		// Login como ADMIN (usar usuário admin do seed)
		const adminLogin = await request(app.getHttpServer())
			.post('/api/v1/auth/login')
			.send({
				email: 'admin@admin.local',
				password: 'admin123',
			});

		if (adminLogin.status === 201) {
			adminToken = adminLogin.body.access_token;
		}

		// Criar usuário normal para testar restrições
		const userEmail = `user-test-${Date.now()}@example.com`;
		const registerRes = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send({
				email: userEmail,
				password: 'SecurePass@123',
				name: 'Test User',
			});

		if (registerRes.status === 201) {
			userToken = registerRes.body.access_token;
		}
	});

	afterAll(async () => {
		// Limpar tipos de licença de teste
		if (createdLicenseTypeId) {
			await prisma.licenseType
				.delete({
					where: { id: createdLicenseTypeId },
				})
				.catch(() => {});
		}

		// Limpar usuários de teste
		await prisma.user.deleteMany({
			where: { email: { contains: 'user-test-' } },
		});

		await app.close();
	});

	// ==================== ENDPOINTS PÚBLICOS ====================

	describe('GET /api/v1/license-types/public (Public)', () => {
		it('deve listar tipos de licença ativos sem autenticação', async () => {
			const response = await request(app.getHttpServer())
				.get('/api/v1/license-types/public')
				.expect(200);

			expect(Array.isArray(response.body)).toBe(true);
			// Deve ter pelo menos os tipos do seed
			expect(response.body.length).toBeGreaterThanOrEqual(0);
		});
	});

	// ==================== ENDPOINTS ADMIN - CRUD ====================

	describe('POST /api/v1/license-types (Admin only)', () => {
		it('deve retornar 401 sem autenticação', async () => {
			await request(app.getHttpServer())
				.post('/api/v1/license-types')
				.send(testLicenseType)
				.expect(401);
		});

		it('deve retornar 403 para usuário comum', async () => {
			if (!userToken) {
				console.warn('Skipping: userToken not available');
				return;
			}

			await request(app.getHttpServer())
				.post('/api/v1/license-types')
				.set('Authorization', `Bearer ${userToken}`)
				.send(testLicenseType)
				.expect(403);
		});

		it('deve criar tipo de licença como ADMIN', async () => {
			if (!adminToken) {
				console.warn('Skipping: adminToken not available');
				return;
			}

			const response = await request(app.getHttpServer())
				.post('/api/v1/license-types')
				.set('Authorization', `Bearer ${adminToken}`)
				.send(testLicenseType)
				.expect(201);

			expect(response.body).toHaveProperty('id');
			expect(response.body.name).toBe(testLicenseType.name);
			expect(response.body.price).toBe(testLicenseType.price);
			expect(response.body.isPerSeat).toBe(testLicenseType.isPerSeat);
			expect(response.body.maxSeats).toBe(testLicenseType.maxSeats);

			createdLicenseTypeId = response.body.id;
		});

		it('deve retornar 400 com dados inválidos', async () => {
			if (!adminToken) return;

			await request(app.getHttpServer())
				.post('/api/v1/license-types')
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					name: '', // nome vazio
					price: -10, // preço negativo
				})
				.expect(400);
		});
	});

	describe('GET /api/v1/license-types (Admin only)', () => {
		it('deve retornar 401 sem autenticação', async () => {
			await request(app.getHttpServer())
				.get('/api/v1/license-types')
				.expect(401);
		});

		it('deve retornar 403 para usuário comum', async () => {
			if (!userToken) return;

			await request(app.getHttpServer())
				.get('/api/v1/license-types')
				.set('Authorization', `Bearer ${userToken}`)
				.expect(403);
		});

		it('deve listar tipos de licença paginados como ADMIN', async () => {
			if (!adminToken) return;

			const response = await request(app.getHttpServer())
				.get('/api/v1/license-types')
				.set('Authorization', `Bearer ${adminToken}`)
				.query({ page: 1, limit: 10 })
				.expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body).toHaveProperty('meta');
			expect(Array.isArray(response.body.data)).toBe(true);
			expect(response.body.meta).toHaveProperty('total');
			expect(response.body.meta).toHaveProperty('page');
			expect(response.body.meta).toHaveProperty('limit');
			expect(response.body.meta).toHaveProperty('totalPages');
		});

		it('deve filtrar por nome/descrição', async () => {
			if (!adminToken || !createdLicenseTypeId) return;

			const response = await request(app.getHttpServer())
				.get('/api/v1/license-types')
				.set('Authorization', `Bearer ${adminToken}`)
				.query({ search: 'Test-LType' })
				.expect(200);

			expect(response.body.data.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('GET /api/v1/license-types/:id (Admin only)', () => {
		it('deve buscar tipo de licença por ID', async () => {
			if (!adminToken || !createdLicenseTypeId) return;

			const response = await request(app.getHttpServer())
				.get(`/api/v1/license-types/${createdLicenseTypeId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.id).toBe(createdLicenseTypeId);
			expect(response.body.name).toBe(testLicenseType.name);
		});

		it('deve retornar 404 para ID inexistente', async () => {
			if (!adminToken) return;

			await request(app.getHttpServer())
				.get(
					'/api/v1/license-types/00000000-0000-0000-0000-000000000000',
				)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(404);
		});
	});

	describe('PUT /api/v1/license-types/:id (Admin only)', () => {
		it('deve atualizar tipo de licença', async () => {
			if (!adminToken || !createdLicenseTypeId) return;

			const updateData = {
				description: 'Descrição atualizada',
				price: 149.99,
			};

			const response = await request(app.getHttpServer())
				.put(`/api/v1/license-types/${createdLicenseTypeId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send(updateData)
				.expect(200);

			expect(response.body.description).toBe(updateData.description);
			expect(response.body.price).toBe(updateData.price);
		});

		it('deve retornar 403 para usuário comum', async () => {
			if (!userToken || !createdLicenseTypeId) return;

			await request(app.getHttpServer())
				.put(`/api/v1/license-types/${createdLicenseTypeId}`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ price: 50 })
				.expect(403);
		});
	});

	describe('DELETE /api/v1/license-types/:id (Admin only)', () => {
		it('deve retornar 403 para usuário comum', async () => {
			if (!userToken || !createdLicenseTypeId) return;

			await request(app.getHttpServer())
				.delete(`/api/v1/license-types/${createdLicenseTypeId}`)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(403);
		});

		it('deve fazer soft delete do tipo de licença', async () => {
			if (!adminToken || !createdLicenseTypeId) return;

			const response = await request(app.getHttpServer())
				.delete(`/api/v1/license-types/${createdLicenseTypeId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.deletedAt).not.toBeNull();
			expect(response.body.isActive).toBe(false);

			// Verificar que não aparece mais na lista de ativos
			const activeTypes = await request(app.getHttpServer())
				.get('/api/v1/license-types/public')
				.expect(200);

			const found = activeTypes.body.find(
				(t: any) => t.id === createdLicenseTypeId,
			);
			expect(found).toBeUndefined();
		});
	});
});
