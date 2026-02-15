import {
	Controller,
	Get,
	Post,
	Delete,
	Body,
	Param,
	Query,
	UseGuards,
	HttpCode,
	HttpStatus,
	HttpException,
} from '@nestjs/common';
import {
	ApiBearerAuth,
	ApiSecurity,
	ApiOperation,
	ApiTags,
	ApiResponse,
	ApiQuery,
	ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SeatService } from './seat.service';
import { SeatAllocationCode } from './license.enums';
import { SeatPaginationParams } from './license.interfaces';
import { CreateSeatDto } from './dto/create-seat.dto';
import type { User } from '@prisma/client';

/** Mapeia cada code de falha para o HTTP status correspondente */
const ALLOCATION_ERROR_STATUS: Record<
	Exclude<SeatAllocationCode, SeatAllocationCode.SEAT_ALLOCATED>,
	HttpStatus
> = {
	[SeatAllocationCode.LICENSE_NOT_FOUND]: HttpStatus.NOT_FOUND,
	[SeatAllocationCode.LICENSE_DELETED]: HttpStatus.NOT_FOUND,
	[SeatAllocationCode.LICENSE_INACTIVE]: HttpStatus.BAD_REQUEST,
	[SeatAllocationCode.LICENSE_EXPIRED]: HttpStatus.BAD_REQUEST,
	[SeatAllocationCode.LICENSE_SEATS_EXCEEDED]: HttpStatus.BAD_REQUEST,
	[SeatAllocationCode.SEAT_USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
	[SeatAllocationCode.SEAT_ALREADY_EXISTS]: HttpStatus.CONFLICT,
};

@ApiTags('Seats')
@Controller('licenses/:licenseId/seats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('OAuth2-login')
export class SeatController {
	constructor(private readonly seatService: SeatService) {}

	@Get()
	@UseGuards(RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiOperation({ summary: 'Listar seats de uma licença (ADMIN)' })
	@ApiParam({ name: 'licenseId', description: 'ID da licença' })
	@ApiQuery({ name: 'page', required: false, type: Number })
	@ApiQuery({ name: 'limit', required: false, type: Number })
	@ApiQuery({ name: 'isActive', required: false, type: Boolean })
	@ApiResponse({ status: 200, description: 'Lista paginada de seats' })
	async findByLicense(
		@Param('licenseId') licenseId: string,
		@Query('page') page?: number,
		@Query('limit') limit?: number,
		@Query('isActive') isActive?: boolean,
	) {
		const params: SeatPaginationParams = {
			page: page ? Number(page) : 1,
			limit: limit ? Number(limit) : 10,
			isActive: isActive !== undefined ? Boolean(isActive) : undefined,
		};
		return this.seatService.findByLicense(licenseId, params);
	}

	@Post()
	@UseGuards(RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiOperation({ summary: 'Alocar seat para um usuário (ADMIN)' })
	@ApiParam({ name: 'licenseId', description: 'ID da licença' })
	@ApiResponse({ status: 201, description: 'Seat alocado' })
	@ApiResponse({
		status: 400,
		description: 'Limite de seats ou validação falhou',
	})
	@ApiResponse({
		status: 404,
		description: 'Licença ou usuário não encontrado',
	})
	@ApiResponse({
		status: 409,
		description: 'Usuário já possui seat nesta licença',
	})
	async allocate(
		@Param('licenseId') licenseId: string,
		@Body() dto: Omit<CreateSeatDto, 'licenseId'>,
	) {
		const result = await this.seatService.allocate({
			...dto,
			licenseId,
		});

		if (!result.success) {
			const status =
				ALLOCATION_ERROR_STATUS[
					result.code as Exclude<SeatAllocationCode, 'SEAT_ALLOCATED'>
				] ?? HttpStatus.BAD_REQUEST;

			throw new HttpException(
				{
					statusCode: status,
					message: result.reason,
					code: result.code,
				},
				status,
			);
		}

		return result;
	}

	@Get(':seatId')
	@UseGuards(RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@ApiOperation({ summary: 'Buscar seat por ID (ADMIN)' })
	@ApiParam({ name: 'licenseId', description: 'ID da licença' })
	@ApiParam({ name: 'seatId', description: 'ID do seat' })
	@ApiResponse({ status: 200, description: 'Seat encontrado' })
	@ApiResponse({ status: 404, description: 'Seat não encontrado' })
	async findById(@Param('seatId') seatId: string) {
		return this.seatService.findById(seatId);
	}

	@Delete(':seatId')
	@UseGuards(RolesGuard)
	@Roles('ADMIN', 'SYSTEM')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Revogar seat (ADMIN)' })
	@ApiParam({ name: 'licenseId', description: 'ID da licença' })
	@ApiParam({ name: 'seatId', description: 'ID do seat' })
	@ApiResponse({ status: 200, description: 'Seat revogado' })
	@ApiResponse({ status: 404, description: 'Seat não encontrado' })
	async revoke(@Param('seatId') seatId: string) {
		await this.seatService.revoke(seatId);
		return { message: 'Seat revogado com sucesso' };
	}
}

@ApiTags('My Seats')
@Controller('seats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('OAuth2-login')
export class MySeatController {
	constructor(private readonly seatService: SeatService) {}

	@Get('my')
	@ApiOperation({ summary: 'Listar meus seats (licenças alocadas para mim)' })
	@ApiResponse({ status: 200, description: 'Lista de seats do usuário' })
	async findMySeats(@CurrentUser() user: User) {
		return this.seatService.findByUser(user.id);
	}
}
