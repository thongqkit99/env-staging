import { Controller, Post, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  DataIngestionService,
  MacroImportResponse,
  MacroImportStatus,
  MacroSourceValidation,
} from '../services/data-ingestion.service';

@ApiTags('Data Ingestion')
@Controller('data-ingestion')
export class DataIngestionController {
  constructor(private readonly dataIngestionService: DataIngestionService) {}

  @Post('macro-import/run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Run macro indicators import',
    description:
      'Import macro indicators data from JSON file into database synchronously',
  })
  @ApiResponse({
    status: 200,
    description: 'Import completed successfully',
    type: Object,
  })
  @ApiResponse({
    status: 409,
    description: 'Import is already running',
  })
  @ApiResponse({
    status: 500,
    description: 'Import failed',
  })
  @ApiResponse({
    status: 503,
    description: 'Data ingestion service unavailable',
  })
  async runMacroImport(): Promise<MacroImportResponse> {
    return await this.dataIngestionService.runMacroImport();
  }

  @Post('macro-import/run-async')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Run macro indicators import in background',
    description: 'Start macro indicators import as a background task',
  })
  @ApiResponse({
    status: 202,
    description: 'Background import started successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        status: { type: 'string' },
        check_status_endpoint: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Import is already running',
  })
  @ApiResponse({
    status: 503,
    description: 'Data ingestion service unavailable',
  })
  async runMacroImportAsync(): Promise<{
    message: string;
    status: string;
    check_status_endpoint: string;
  }> {
    return await this.dataIngestionService.runMacroImportAsync();
  }

  @Get('macro-import/status')
  @ApiOperation({
    summary: 'Get import status',
    description: 'Get the current status of macro indicators import',
  })
  @ApiResponse({
    status: 200,
    description: 'Import status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
        started_at: { type: 'string', nullable: true },
        completed_at: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Data ingestion service unavailable',
  })
  async getImportStatus(): Promise<MacroImportStatus> {
    return await this.dataIngestionService.getImportStatus();
  }

  @Get('macro-import/last-result')
  @ApiOperation({
    summary: 'Get last import result',
    description: 'Get the result of the last macro indicators import operation',
  })
  @ApiResponse({
    status: 200,
    description: 'Last import result retrieved successfully',
    type: Object,
  })
  @ApiResponse({
    status: 404,
    description: 'No import has been run yet',
  })
  @ApiResponse({
    status: 503,
    description: 'Data ingestion service unavailable',
  })
  async getLastImportResult(): Promise<MacroImportResponse> {
    return await this.dataIngestionService.getLastImportResult();
  }

  @Get('macro-import/validate-source')
  @ApiOperation({
    summary: 'Validate source file',
    description:
      'Validate the macro indicators JSON source file without importing',
  })
  @ApiResponse({
    status: 200,
    description: 'Source file validation completed',
    schema: {
      type: 'object',
      properties: {
        file_exists: { type: 'boolean' },
        total_records: { type: 'number' },
        successful_indicators: { type: 'number' },
        failed_indicators: { type: 'number' },
        errors_count: { type: 'number' },
        file_path: { type: 'string' },
        export_timestamp: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Source file not found',
  })
  @ApiResponse({
    status: 503,
    description: 'Data ingestion service unavailable',
  })
  async validateSourceFile(): Promise<MacroSourceValidation> {
    return await this.dataIngestionService.validateSourceFile();
  }

  @Get('macro-import/health')
  @ApiOperation({
    summary: 'Check import service health',
    description: 'Check the health of the macro import service',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        source_file_exists: { type: 'boolean' },
        source_file_path: { type: 'string' },
        current_import_status: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Data ingestion service unavailable',
  })
  async checkImportServiceHealth(): Promise<{
    status: string;
    source_file_exists: boolean;
    source_file_path: string;
    current_import_status: string;
  }> {
    return await this.dataIngestionService.checkImportServiceHealth();
  }

  @Get('service/availability')
  @ApiOperation({
    summary: 'Check service availability',
    description: 'Check if the data ingestion service is available',
  })
  @ApiResponse({
    status: 200,
    description: 'Service availability check completed',
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean' },
        service_url: { type: 'string' },
      },
    },
  })
  async checkServiceAvailability(): Promise<{
    available: boolean;
    service_url: string;
  }> {
    const available =
      await this.dataIngestionService.checkServiceAvailability();
    return {
      available,
      service_url: this.dataIngestionService['dataIngestionBaseUrl'],
    };
  }

  @Get('service/info')
  @ApiOperation({
    summary: 'Get service information',
    description: 'Get information about the data ingestion service',
  })
  @ApiResponse({
    status: 200,
    description: 'Service information retrieved successfully',
    type: Object,
  })
  @ApiResponse({
    status: 503,
    description: 'Data ingestion service unavailable',
  })
  async getServiceInfo(): Promise<any> {
    return await this.dataIngestionService.getServiceInfo();
  }
}
