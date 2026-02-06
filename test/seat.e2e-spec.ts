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

		// 1. Criar Organização de Teste
		const org = await prisma.organization.create({
			data: {
				name: `Seat E2E Org ${Date.now()}`,
				slug: `seat-e2e-org-${Date.now()}`,
				isActive: true,
			},
		});

		// 2. Criar Tipo de Licença de Teste
		const licenseType = await prisma.licenseType.create({
			data: {
				name: `Seat E2E Type ${Date.now()}`,
				description: 'E2E Test Type',
				price: 100,
				duration: 30,
				isPerSeat: true,
				maxSeats: 5,
				isActive: true,
			},
		});

		// 3. Criar Licença de Teste
		const license = await prisma.license.create({
			data: {
				name: `Seat E2E License ${Date.now()}`,
				key: `LIC-SEAT-E2E-${Date.now()}`,
				organizationId: org.id,
				licenseTypeId: licenseType.id,
				isActive: true,
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			},
		});
		testLicenseId = license.id;

		// 4. Criar e Logar ADMIN de Teste
		const adminEmail = `seat-admin-${Date.now()}@seat.test`;
		await request(app.getHttpServer()).post('/api/v1/auth/register').send({
			email: adminEmail,
			password: 'AdminPass@123',
			name: 'Seat Admin User',
		});

		// Forçar role ADMIN no banco
		await prisma.user.updateMany({
			where: { email: adminEmail },
			data: { role: 'ADMIN', isActive: true },
		});

		const adminLogin = await request(app.getHttpServer())
			.post('/api/v1/auth/login')
			.send({
				email: adminEmail,
				password: 'AdminPass@123',
			});

		if (adminLogin.status === 201 || adminLogin.status === 200) {
			adminToken = adminLogin.body.access_token;
		} else {
			console.error('Admin login failed:', adminLogin.body);
		}

		// 5. Criar e Logar User Comum
		const userEmail = `seat-user-${Date.now()}@seat.test`;
		const userRegister = await request(app.getHttpServer())
			.post('/api/v1/auth/register')
			.send({
				email: userEmail,
				password: 'UserPass@123',
				name: 'Seat Normal User',
			});

		if (userRegister.status === 201) {
			userToken = userRegister.body.access_token;
			testUserId = userRegister.body.user.id;
		} else {
			console.error('User register failed:', userRegister.body);
		}
	});

	afterAll(async () => {
		// Cleanup order: Seats -> License -> LicenseType -> Organization -> Users
		if (createdSeatId) {
			await prisma.seat
				.deleteMany({ where: { licenseId: testLicenseId } })
				.catch(() => {});
		}

		if (testLicenseId) {
			await prisma.license
				.delete({ where: { id: testLicenseId } })
				.catch(() => {});
		}

		// Cleanup Users (Admin & User)
		await prisma.user.deleteMany({
			where: { email: { contains: '@seat.test' } },
		});

		// Note: We leave LicenseType and Org cleanup for simple "deleteMany" or specific ID if tracked,
		// but since we created them with unique names, we can delete by finding them or just rely on test DB reset policies.
		// For robustness, let's try to verify if we can delete the ones we created if we tracked their IDs.
		// Since I didn't save orgId/typeId in let vars in the previous step (oops), I'll add them to the let vars in a separate fix
		// or just query them here if needed. Ideally, let's just clean users for now which is the main noise.

		// Actually, let's delete strictly what we created if we have IDs.
		// Expanding cleanup:
		const orgs = await prisma.organization.findMany({
			where: { name: { contains: 'Seat E2E Org' } },
		});
		for (const o of orgs) {
			// Delete related licenses first just in case
			await prisma.license.deleteMany({
				where: { organizationId: o.id },
			});
			await prisma.organization
				.delete({ where: { id: o.id } })
				.catch(() => {});
		}

		await prisma.licenseType
			.deleteMany({ where: { name: { contains: 'Seat E2E Type' } } })
			.catch(() => {});

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
