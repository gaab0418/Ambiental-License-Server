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
import { LicenseTypeService, PaginationParams } from './license-type.service';
import { CreateLicenseTypeDto } from './dto/create-license-type.dto';
import { UpdateLicenseTypeDto } from './dto/update-license-type.dto';

@ApiTags('License Types')
@Controller('license-types')
export class LicenseTypeController {
	constructor(private readonly licenseTypeService: LicenseTypeService) {}

	// ==================== PUBLIC ENDPOINTS ====================

	@Get('public')
	@ApiOperation({ summary: 'Listar tipos de licença ativos (público)' })
	@ApiResponse({
		status: 200,
		description: 'Lista de tipos de licença ativos',
	})
	async findActiveTypes() {
		return this.licenseTypeService.findActiveTypes();
	}

	// ==================== PROTECTED ENDPOINTS ====================

	@Get()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@ApiOperation({ summary: 'Listar todos os tipos de licença (ADMIN)' })
	@ApiQuery({ name: 'page', required: false, type: Number })
	@ApiQuery({ name: 'limit', required: false, type: Number })
	@ApiQuery({ name: 'search', required: false, type: String })
	@ApiQuery({ name: 'isActive', required: false, type: Boolean })
	@ApiResponse({
		status: 200,
		description: 'Lista paginada de tipos de licença',
	})
	async findAll(
		@Query('page') page?: number,
		@Query('limit') limit?: number,
		@Query('search') search?: string,
		@Query('isActive') isActive?: boolean,
	) {
		const params: PaginationParams = {
			page: page ? Number(page) : 1,
			limit: limit ? Number(limit) : 10,
			search,
			isActive: isActive !== undefined ? Boolean(isActive) : undefined,
		};
		return this.licenseTypeService.findAll(params);
	}

	@Get(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@ApiOperation({ summary: 'Buscar tipo de licença por ID (ADMIN)' })
	@ApiResponse({ status: 200, description: 'Tipo de licença encontrado' })
	@ApiResponse({ status: 404, description: 'Tipo de licença não encontrado' })
	async findById(@Param('id') id: string) {
		return this.licenseTypeService.findById(id);
	}

	@Post()
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@ApiOperation({ summary: 'Criar novo tipo de licença (ADMIN)' })
	@ApiResponse({ status: 201, description: 'Tipo de licença criado' })
	async create(@Body() dto: CreateLicenseTypeDto) {
		return this.licenseTypeService.create(dto);
	}

	@Put(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@ApiOperation({ summary: 'Atualizar tipo de licença (ADMIN)' })
	@ApiResponse({ status: 200, description: 'Tipo de licença atualizado' })
	@ApiResponse({ status: 404, description: 'Tipo de licença não encontrado' })
	async update(@Param('id') id: string, @Body() dto: UpdateLicenseTypeDto) {
		return this.licenseTypeService.update(id, dto);
	}

	@Delete(':id')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiBearerAuth('JWT-auth')
	@ApiSecurity('OAuth2-login')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Remover tipo de licença (soft delete) (ADMIN)' })
	@ApiResponse({ status: 200, description: 'Tipo de licença removido' })
	@ApiResponse({ status: 404, description: 'Tipo de licença não encontrado' })
	async delete(@Param('id') id: string) {
		await this.licenseTypeService.delete(id);
		return { message: 'Tipo de licença removido com sucesso' };
	}
}
