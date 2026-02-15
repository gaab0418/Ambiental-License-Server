import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	Query,
	UseGuards,
	HttpCode,
	HttpStatus,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiSecurity,
	ApiOperation,
	ApiTags,
	ApiResponse,
	ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LicenseService } from './license.service';
import { LicensePaginationParams } from './license.interfaces';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { ValidateLicenseDto } from './dto/validate-license.dto';
import { RenewLicenseDto } from './dto/renew-license.dto';
import type { User } from '@prisma/client';

@ApiTags('Licenses')
@Controller('licenses')
export class LicenseController {
	constructor(private readonly licenseService: LicenseService) {}

	// ==================== PUBLIC ENDPOINTS ====================

	@Post('validate')
	@ApiOperation({ summary: 'Validar licença por chave (público)' })
	@ApiResponse({ status: 200, description: 'Resultado da validação' })
	@HttpCode(HttpStatus.OK)
	async validateLicense(@Body() dto: ValidateLicenseDto) {
		return this.licenseService.validateLicenseKey(dto.key);
	}

	// ==================== USER ENDPOINTS ====================

	@Get('my')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@ApiOperation({ summary: 'Listar licenças da minha organização' })
	@ApiQuery({ name: 'page', required: false, type: Number })
	@ApiQuery({ name: 'limit', required: false, type: Number })
	@ApiResponse({
		status: 200,
		description: 'Licenças da organização do usuário',
	})
	async findMyLicenses(
		@CurrentUser() user: User,
		@Query('page') page?: number,
		@Query('limit') limit?: number,
	) {
		if (!user.organizationId) {
			return {
				data: [],
				meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
				message: 'Usuário não pertence a uma organização',
			};
		}

		return this.licenseService.findByOrganization(user.organizationId, {
			page: page ? Number(page) : 1,
			limit: limit ? Number(limit) : 10,
		});
	}

	// ==================== ADMIN ENDPOINTS ====================

	@Get()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@ApiOperation({ summary: 'Listar todas as licenças (ADMIN)' })
	@ApiQuery({ name: 'page', required: false, type: Number })
	@ApiQuery({ name: 'limit', required: false, type: Number })
	@ApiQuery({ name: 'search', required: false, type: String })
	@ApiQuery({ name: 'isActive', required: false, type: Boolean })
	@ApiQuery({ name: 'organizationId', required: false, type: String })
	@ApiQuery({ name: 'licenseTypeId', required: false, type: String })
	@ApiResponse({ status: 200, description: 'Lista paginada de licenças' })
	async findAll(
		@Query('page') page?: number,
		@Query('limit') limit?: number,
		@Query('search') search?: string,
		@Query('isActive') isActive?: boolean,
		@Query('organizationId') organizationId?: string,
		@Query('licenseTypeId') licenseTypeId?: string,
	) {
		const params: LicensePaginationParams = {
			page: page ? Number(page) : 1,
			limit: limit ? Number(limit) : 10,
			search,
			isActive: isActive !== undefined ? Boolean(isActive) : undefined,
			organizationId,
			licenseTypeId,
		};
		return this.licenseService.findAll(params);
	}

	@Get(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@ApiOperation({ summary: 'Buscar licença por ID (ADMIN)' })
	@ApiResponse({ status: 200, description: 'Licença encontrada' })
	@ApiResponse({ status: 404, description: 'Licença não encontrada' })
	async findById(@Param('id') id: string) {
		return this.licenseService.findById(id);
	}

	@Post()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@ApiOperation({
		summary: 'Criar nova licença (ADMIN) - key gerada automaticamente',
	})
	@ApiResponse({ status: 201, description: 'Licença criada' })
	async create(@Body() dto: CreateLicenseDto) {
		return this.licenseService.create(dto);
	}

	@Put(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@ApiOperation({ summary: 'Atualizar licença (ADMIN)' })
	@ApiResponse({ status: 200, description: 'Licença atualizada' })
	@ApiResponse({ status: 404, description: 'Licença não encontrada' })
	async update(@Param('id') id: string, @Body() dto: UpdateLicenseDto) {
		return this.licenseService.update(id, dto);
	}

	@Post(':id/renew')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Renovar licença por X dias (ADMIN)' })
	@ApiResponse({ status: 200, description: 'Licença renovada' })
	@ApiResponse({ status: 404, description: 'Licença não encontrada' })
	async renew(@Param('id') id: string, @Body() dto: RenewLicenseDto) {
		return this.licenseService.renewLicense(id, dto.durationDays);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Remover licença (soft delete) (ADMIN)' })
	@ApiResponse({ status: 200, description: 'Licença removida' })
	@ApiResponse({ status: 404, description: 'Licença não encontrada' })
	async delete(@Param('id') id: string) {
		await this.licenseService.delete(id);
		return { message: 'Licença removida com sucesso' };
	}
}
