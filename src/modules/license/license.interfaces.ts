import { LicenseValidationCode, SeatAllocationCode } from './license.enums';

// ==================== Pagination ====================

export interface PaginatedResult<T> {
	data: T[];
	meta: {
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	};
}

export interface LicensePaginationParams {
	page?: number;
	limit?: number;
	search?: string;
	isActive?: boolean;
	organizationId?: string;
	licenseTypeId?: string;
}

export interface SeatPaginationParams {
	page?: number;
	limit?: number;
	isActive?: boolean;
}

// ==================== Validation / Allocation Results ====================

export interface LicenseValidationResult {
	isValid: boolean;
	license?: any;
	reason?: string;
	code: LicenseValidationCode;
}

export interface SeatAllocationResult {
	success: boolean;
	seat?: any;
	reason?: string;
	code: SeatAllocationCode;
}
