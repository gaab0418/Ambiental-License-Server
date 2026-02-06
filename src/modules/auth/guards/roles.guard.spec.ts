import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
	let guard: RolesGuard;
	let reflector: Reflector;

	const mockReflector = {
		getAllAndOverride: jest.fn(),
	};

	const createMockContext = (user: any = null): ExecutionContext => {
		return {
			getHandler: jest.fn(),
			getClass: jest.fn(),
			switchToHttp: () => ({
				getRequest: () => ({ user }),
			}),
		} as unknown as ExecutionContext;
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				RolesGuard,
				{ provide: Reflector, useValue: mockReflector },
			],
		}).compile();

		guard = module.get<RolesGuard>(RolesGuard);
		reflector = module.get<Reflector>(Reflector);
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(guard).toBeDefined();
	});

	describe('canActivate', () => {
		it('deve permitir acesso se nenhuma role é requerida', () => {
			mockReflector.getAllAndOverride.mockReturnValue(undefined);
			const context = createMockContext({ id: 'user-1', role: 'USER' });

			const result = guard.canActivate(context);

			expect(result).toBe(true);
		});

		it('deve permitir acesso se roles requeridas estão vazias', () => {
			mockReflector.getAllAndOverride.mockReturnValue([]);
			const context = createMockContext({ id: 'user-1', role: 'USER' });

			const result = guard.canActivate(context);

			expect(result).toBe(true);
		});

		it('deve lançar ForbiddenException se usuário não está autenticado', () => {
			mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
			const context = createMockContext(null);

			expect(() => guard.canActivate(context)).toThrow(
				ForbiddenException,
			);
			expect(() => guard.canActivate(context)).toThrow(
				'Usuário não autenticado',
			);
		});

		it('deve permitir acesso se SYSTEM role (acesso total)', () => {
			mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
			const context = createMockContext({ id: 'user-1', role: 'SYSTEM' });

			const result = guard.canActivate(context);

			expect(result).toBe(true);
		});

		it('deve permitir acesso se usuário tem a role requerida', () => {
			mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
			const context = createMockContext({ id: 'user-1', role: 'ADMIN' });

			const result = guard.canActivate(context);

			expect(result).toBe(true);
		});

		it('deve permitir acesso se usuário tem uma das roles requeridas', () => {
			mockReflector.getAllAndOverride.mockReturnValue([
				'ADMIN',
				'MANAGER',
			]);
			const context = createMockContext({
				id: 'user-1',
				role: 'MANAGER',
			});

			const result = guard.canActivate(context);

			expect(result).toBe(true);
		});

		it('deve lançar ForbiddenException se usuário não tem a role requerida', () => {
			mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
			const context = createMockContext({ id: 'user-1', role: 'USER' });

			expect(() => guard.canActivate(context)).toThrow(
				ForbiddenException,
			);
			expect(() => guard.canActivate(context)).toThrow('Acesso negado');
		});

		it('deve incluir roles requeridas na mensagem de erro', () => {
			mockReflector.getAllAndOverride.mockReturnValue([
				'ADMIN',
				'MANAGER',
			]);
			const context = createMockContext({ id: 'user-1', role: 'USER' });

			try {
				guard.canActivate(context);
				fail('Should have thrown ForbiddenException');
			} catch (error) {
				expect(error.message).toContain('ADMIN');
				expect(error.message).toContain('MANAGER');
			}
		});

		it('deve verificar corretamente o ROLES_KEY do reflector', () => {
			mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);
			const context = createMockContext({ id: 'user-1', role: 'ADMIN' });

			guard.canActivate(context);

			expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
				ROLES_KEY,
				[context.getHandler(), context.getClass()],
			);
		});
	});
});
