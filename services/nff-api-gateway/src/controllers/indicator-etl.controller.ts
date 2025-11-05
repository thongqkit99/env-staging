import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { IndicatorETLService } from '../services/indicator-etl.service';
import {
  ImportExcelDto,
  FullFetchDto,
  IncrementalFetchDto,
} from '../dto/indicator-etl.dto';
import { CleanETLTablesDto } from '../dto/clean-etl.dto';

@ApiTags('Indicator ETL')
@Controller('indicators/etl')
export class IndicatorETLController {
  private readonly logger = new Logger(IndicatorETLController.name);

  constructor(private readonly indicatorETLService: IndicatorETLService) {}

  @Post('full-fetch')
  @ApiOperation({ summary: 'Trigger full historical fetch for a category' })
  @ApiResponse({ status: 200, description: 'ETL job started successfully' })
  async triggerFullFetch(@Body() request: FullFetchDto) {
    try {
      this.logger.log(
        `Triggering full fetch for category: ${request.categoryName}`,
      );

      const result = await this.indicatorETLService.triggerFullHistoricalFetch(
        request.categoryName,
        request.startDate,
        request.endDate,
        request.importanceMin,
      );

      return {
        success: true,
        message: `Full historical fetch started for category '${request.categoryName}'`,
        jobId: result.jobId,
        metadata: result.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to trigger full fetch: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to trigger full fetch: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('incremental-fetch')
  @ApiOperation({ summary: 'Trigger incremental fetch for a category' })
  @ApiResponse({ status: 200, description: 'ETL job started successfully' })
  async triggerIncrementalFetch(@Body() request: IncrementalFetchDto) {
    try {
      this.logger.log(
        `Triggering incremental fetch for category: ${request.categoryName}`,
      );

      const result = await this.indicatorETLService.triggerIncrementalFetch(
        request.categoryName,
        request.daysBack || 30,
        request.importanceMin,
      );

      return {
        success: true,
        message: `Incremental fetch started for category '${request.categoryName}'`,
        jobId: result.jobId,
        metadata: result.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to trigger incremental fetch: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to trigger incremental fetch: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('import-excel')
  @ApiOperation({
    summary: 'Import indicators from Excel file using EXCEL_IMPORT_PATH',
  })
  @ApiResponse({
    status: 200,
    description: 'Excel import started successfully',
  })
  async importFromExcel(@Body() request: ImportExcelDto) {
    try {
      const excelPath = process.env.EXCEL_IMPORT_PATH;
      if (!excelPath) {
        throw new HttpException(
          'EXCEL_IMPORT_PATH environment variable is not set',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(
        `Importing indicators from Excel: ${excelPath} -> ${request.sheetName} -> ${request.categoryName}`,
      );

      const result = await this.indicatorETLService.importIndicatorsFromExcel(
        excelPath,
        request.sheetName,
        request.categoryName,
      );

      return {
        success: true,
        message: `Excel import started for sheet '${request.sheetName}' -> category '${request.categoryName}'`,
        jobId: result.jobId,
        metadata: result.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to import from Excel: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to import from Excel: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('import-and-fetch')
  @ApiOperation({
    summary: 'Import from Excel AND fetch data in one call',
    description:
      'Complete pipeline: Read Excel → Import metadata → Fetch data from APIs → ETL processing → Save to DB',
  })
  @ApiResponse({
    status: 200,
    description: 'Import and fetch completed successfully',
  })
  async importAndFetch(
    @Body()
    request: {
      categoryName: string;
      startDate?: string;
      endDate?: string;
      importanceMin?: number;
    },
  ) {
    try {
      this.logger.log(
        `Starting import-and-fetch for category: ${request.categoryName}`,
      );

      const result = await this.indicatorETLService.importAndFetchCategory(
        request.categoryName,
        request.startDate,
        request.endDate,
        request.importanceMin,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to import and fetch: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to import and fetch: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('job-status/:jobId')
  @ApiOperation({ summary: 'Get ETL job status' })
  @ApiParam({ name: 'jobId', description: 'ETL Job ID' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  async getJobStatus(@Param('jobId') jobId: string) {
    try {
      const status = await this.indicatorETLService.getETLJobStatus(jobId);
      return {
        success: true,
        jobId: jobId,
        status: status,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get job status: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get job status: ${error.message}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('jobs/all')
  @ApiOperation({ summary: 'Get all ETL jobs' })
  @ApiResponse({ status: 200, description: 'All jobs retrieved' })
  async getAllJobs() {
    try {
      // Proxy to Python service
      const jobs = await this.indicatorETLService.getAllETLJobs();
      return {
        success: true,
        jobs: jobs,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get all jobs: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to get jobs: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('check-excel')
  @ApiOperation({ summary: 'Check if Excel file exists at EXCEL_IMPORT_PATH' })
  @ApiResponse({ status: 200, description: 'Excel file status checked' })
  async checkExcelFile() {
    try {
      const excelPath = process.env.EXCEL_IMPORT_PATH;
      if (!excelPath) {
        return {
          success: false,
          message: 'EXCEL_IMPORT_PATH environment variable is not set',
          excelPath: null,
          exists: false,
        };
      }

      this.logger.log(`Checking Excel file at: ${excelPath}`);

      const result =
        await this.indicatorETLService.checkExcelFileExists(excelPath);

      return {
        success: true,
        message: result.exists
          ? 'Excel file is accessible'
          : 'Excel file not found or not accessible',
        excelPath: excelPath,
        exists: result.exists,
        fileSize: result.fileSize,
        lastModified: result.lastModified,
      };
    } catch (error) {
      this.logger.error(
        `Failed to check Excel file: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Failed to check Excel file: ${error.message}`,
        excelPath: process.env.EXCEL_IMPORT_PATH,
        exists: false,
      };
    }
  }

  @Post('clean-etl-tables')
  @ApiOperation({
    summary: 'Clean all ETL-related tables',
    description:
      'Clean all ETL tables: IndicatorETLLog, IndicatorMetadata, IndicatorReportDefault, IndicatorTimeSeries, ETLJob',
  })
  @ApiResponse({
    status: 200,
    description: 'ETL tables cleaned successfully',
  })
  async cleanETLTables(@Body() body: CleanETLTablesDto) {
    this.logger.log(`Received confirmCleanup: ${body.confirmCleanup}`);

    if (body.confirmCleanup !== true) {
      this.logger.warn('Cleanup confirmation required');
      throw new HttpException(
        'Cleanup confirmation required. Set confirmCleanup to true.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.logger.log('Starting ETL tables cleanup...');

      const result = await this.indicatorETLService.cleanETLTables();

      return {
        success: true,
        message: 'ETL tables cleaned successfully',
        deleted: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to clean ETL tables: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to clean ETL tables: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
