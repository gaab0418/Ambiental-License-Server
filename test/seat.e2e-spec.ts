import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/prisma/prisma.service';

describe('SeatController (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;

	let userToken: string;
	let adminToken: string;

	let testLicenseId: string;
	let testUserId: string;
	let createdSeatId: string;

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

		// Criar usuário de teste
		const userEmail = `seat-test-${Date.now()}@example.com`;
		const registerRes = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send({
				email: userEmail,
				password: 'SecurePass@123',
				name: 'Seat Test User',
			});

		if (registerRes.status === 201) {
			userToken = registerRes.body.access_token;
			testUserId = registerRes.body.user.id;
		}

		// Buscar licença do seed para testes
		const license = await prisma.license.findFirst({
			where: { isActive: true, deletedAt: null },
		});
		if (license) testLicenseId = license.id;
	});

	afterAll(async () => {
		// Limpar seats de teste
		if (createdSeatId) {
			await prisma.seat
				.delete({
					where: { id: createdSeatId },
				})
				.catch(() => {});
		}

		// Limpar usuários de teste
		await prisma.user.deleteMany({
			where: { email: { contains: 'seat-test-' } },
		});

		await app.close();
	});

	// ==================== ENDPOINTS DO USUÁRIO ====================

	describe('GET /api/v1/seats/my (User)', () => {
		it('deve retornar 401 sem autenticação', async () => {
			await request(app.getHttpServer())
				.get('/api/v1/seats/my')
				.expect(401);
		});

		it('deve listar meus seats alocados', async () => {
			if (!userToken) return;

			const response = await request(app.getHttpServer())
				.get('/api/v1/seats/my')
				.set('Authorization', `Bearer ${userToken}`)
				.expect(200);

			expect(Array.isArray(response.body)).toBe(true);
		});
	});

	// ==================== ENDPOINTS ADMIN - ALLOC/LIST/REVOKE ====================

	describe('POST /api/v1/licenses/:licenseId/seats (Admin only)', () => {
		it('deve retornar 401 sem autenticação', async () => {
			if (!testLicenseId) return;

			await request(app.getHttpServer())
				.post(`/api/v1/licenses/${testLicenseId}/seats`)
				.send({ userId: testUserId, duration: 30 })
				.expect(401);
		});

		it('deve retornar 403 para usuário comum', async () => {
			if (!userToken || !testLicenseId) return;

			await request(app.getHttpServer())
				.post(`/api/v1/licenses/${testLicenseId}/seats`)
				.set('Authorization', `Bearer ${userToken}`)
				.send({ userId: testUserId, duration: 30 })
				.expect(403);
		});

		it('deve alocar seat para usuário como ADMIN', async () => {
			if (!adminToken || !testLicenseId || !testUserId) {
				console.warn('Skipping: required data not available');
				return;
			}

			const response = await request(app.getHttpServer())
				.post(`/api/v1/licenses/${testLicenseId}/seats`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ userId: testUserId, duration: 30 })
				.expect(201);

			expect(response.body).toHaveProperty('id');
			expect(response.body.userId).toBe(testUserId);
			expect(response.body.licenseId).toBe(testLicenseId);
			expect(response.body.duration).toBe(30);
			expect(response.body.isActive).toBe(true);

			createdSeatId = response.body.id;
		});

		it('deve retornar 400 se usuário já tem seat na licença', async () => {
			if (!adminToken || !testLicenseId || !testUserId || !createdSeatId)
				return;

			await request(app.getHttpServer())
				.post(`/api/v1/licenses/${testLicenseId}/seats`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ userId: testUserId, duration: 30 })
				.expect(400);
		});

		it('deve retornar 404 para licença inexistente', async () => {
			if (!adminToken || !testUserId) return;

			await request(app.getHttpServer())
				.post(
					'/api/v1/licenses/00000000-0000-0000-0000-000000000000/seats',
				)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({ userId: testUserId, duration: 30 })
				.expect(404);
		});

		it('deve retornar 404 para usuário inexistente', async () => {
			if (!adminToken || !testLicenseId) return;

			await request(app.getHttpServer())
				.post(`/api/v1/licenses/${testLicenseId}/seats`)
				.set('Authorization', `Bearer ${adminToken}`)
				.send({
					userId: '00000000-0000-0000-0000-000000000000',
					duration: 30,
				})
				.expect(404);
		});
	});

	describe('GET /api/v1/licenses/:licenseId/seats (Admin only)', () => {
		it('deve listar seats de uma licença como ADMIN', async () => {
			if (!adminToken || !testLicenseId) return;

			const response = await request(app.getHttpServer())
				.get(`/api/v1/licenses/${testLicenseId}/seats`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body).toHaveProperty('data');
			expect(response.body).toHaveProperty('meta');
			expect(Array.isArray(response.body.data)).toBe(true);
		});

		it('deve paginar resultados', async () => {
			if (!adminToken || !testLicenseId) return;

			const response = await request(app.getHttpServer())
				.get(`/api/v1/licenses/${testLicenseId}/seats`)
				.set('Authorization', `Bearer ${adminToken}`)
				.query({ page: 1, limit: 5 })
				.expect(200);

			expect(response.body.meta.limit).toBe(5);
			expect(response.body.meta.page).toBe(1);
		});

		it('deve retornar 404 para licença inexistente', async () => {
			if (!adminToken) return;

			await request(app.getHttpServer())
				.get(
					'/api/v1/licenses/00000000-0000-0000-0000-000000000000/seats',
				)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(404);
		});
	});

	describe('GET /api/v1/licenses/:licenseId/seats/:seatId (Admin only)', () => {
		it('deve buscar seat por ID', async () => {
			if (!adminToken || !testLicenseId || !createdSeatId) return;

			const response = await request(app.getHttpServer())
				.get(`/api/v1/licenses/${testLicenseId}/seats/${createdSeatId}`)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.id).toBe(createdSeatId);
			expect(response.body).toHaveProperty('user');
			expect(response.body).toHaveProperty('license');
		});

		it('deve retornar 404 para seat inexistente', async () => {
			if (!adminToken || !testLicenseId) return;

			await request(app.getHttpServer())
				.get(
					`/api/v1/licenses/${testLicenseId}/seats/00000000-0000-0000-0000-000000000000`,
				)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(404);
		});
	});

	describe('Verificar seat alocado via /seats/my', () => {
		it('deve aparecer na lista de seats do usuário', async () => {
			if (!userToken || !createdSeatId) return;

			const response = await request(app.getHttpServer())
				.get('/api/v1/seats/my')
				.set('Authorization', `Bearer ${userToken}`)
				.expect(200);

			const foundSeat = response.body.find(
				(s: any) => s.id === createdSeatId,
			);
			expect(foundSeat).toBeDefined();
			expect(foundSeat.license).toBeDefined();
		});
	});

	describe('DELETE /api/v1/licenses/:licenseId/seats/:seatId (Admin only)', () => {
		it('deve retornar 403 para usuário comum', async () => {
			if (!userToken || !testLicenseId || !createdSeatId) return;

			await request(app.getHttpServer())
				.delete(
					`/api/v1/licenses/${testLicenseId}/seats/${createdSeatId}`,
				)
				.set('Authorization', `Bearer ${userToken}`)
				.expect(403);
		});

		it('deve revogar (soft delete) seat', async () => {
			if (!adminToken || !testLicenseId || !createdSeatId) return;

			const response = await request(app.getHttpServer())
				.delete(
					`/api/v1/licenses/${testLicenseId}/seats/${createdSeatId}`,
				)
				.set('Authorization', `Bearer ${adminToken}`)
				.expect(200);

			expect(response.body.message).toContain('revogado');

			// Verificar que não aparece mais na lista do usuário
			const mySeats = await request(app.getHttpServer())
				.get('/api/v1/seats/my')
				.set('Authorization', `Bearer ${userToken}`)
				.expect(200);

			const foundSeat = mySeats.body.find(
				(s: any) => s.id === createdSeatId,
			);
			expect(foundSeat).toBeUndefined();
		});
	});
});
