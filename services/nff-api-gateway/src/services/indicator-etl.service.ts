import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import axios from 'axios';

interface ETLJobResult {
  jobId: string;
  metadata: {
    category: string;
    startDate?: string;
    endDate?: string;
    daysBack?: number;
    totalIndicators?: number;
    importanceMin?: number;
    excelPath?: string;
    sheetName?: string;
  };
}

@Injectable()
export class IndicatorETLService {
  private readonly logger = new Logger(IndicatorETLService.name);
  private readonly dataIngestionServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.dataIngestionServiceUrl =
      this.configService.get<string>('DATA_INGESTION_SERVICE_URL') ||
      this.configService.get<string>('PYTHON_SERVICE_URL') ||
      process.env.PYTHON_SERVICE_URL ||
      'http://localhost:8000';
  }

  async triggerFullHistoricalFetch(
    categoryName: string,
    startDate?: string,
    endDate?: string,
    importanceMin?: number,
  ): Promise<ETLJobResult> {
    try {
      const payload = {
        start_date: startDate || '2000-01-01',
        end_date: endDate || new Date().toISOString().split('T')[0],
        importance_min: importanceMin,
      };

      this.logger.log(
        `Calling Python ETL service for full fetch: ${categoryName}`,
      );

      const response = await axios.post(
        `${this.dataIngestionServiceUrl}/api/v1/etl/category/${categoryName}/fetch-all`,
        payload,
        {
          timeout: 30000, // 30 seconds timeout
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        jobId: response.data.job_id,
        metadata: {
          category: categoryName,
          startDate: payload.start_date,
          endDate: payload.end_date,
          importanceMin: importanceMin,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to trigger full historical fetch: ${error.message}`,
        error.stack,
      );
      throw new Error(`Full historical fetch failed: ${error.message}`);
    }
  }

  async triggerIncrementalFetch(
    categoryName: string,
    daysBack: number = 30,
    importanceMin?: number,
  ): Promise<ETLJobResult> {
    try {
      const payload = {
        days_back: daysBack,
        importance_min: importanceMin,
      };

      this.logger.log(
        `Calling Python ETL service for incremental fetch: ${categoryName}`,
      );

      const response = await axios.post(
        `${this.dataIngestionServiceUrl}/api/v1/etl/incremental/${categoryName}`,
        payload,
        {
          timeout: 30000, // 30 seconds timeout
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        jobId: response.data.job_id,
        metadata: {
          category: categoryName,
          daysBack: daysBack,
          importanceMin: importanceMin,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to trigger incremental fetch: ${error.message}`,
        error.stack,
      );
      throw new Error(`Incremental fetch failed: ${error.message}`);
    }
  }

  async importIndicatorsFromExcel(
    excelPath: string,
    sheetName: string,
    categoryName: string,
  ): Promise<ETLJobResult> {
    try {
      const payload = {
        excelPath: excelPath,
        sheetName: sheetName,
        categoryName: categoryName,
      };

      this.logger.log(
        `Calling Python ETL service for Excel import: ${sheetName} -> ${categoryName}`,
      );

      const response = await axios.post(
        `${this.dataIngestionServiceUrl}/api/v1/indicators/import`,
        payload,
        {
          timeout: 60000, // 60 seconds timeout for file processing
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return {
        jobId: response.data.job_id,
        metadata: {
          category: categoryName,
          excelPath: excelPath,
          sheetName: sheetName,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to import from Excel: ${error.message}`,
        error.stack,
      );
      throw new Error(`Excel import failed: ${error.message}`);
    }
  }

  async getETLJobStatus(jobId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.dataIngestionServiceUrl}/api/v1/etl/jobs/${jobId}`,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get ETL job status: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get job status: ${error.message}`);
    }
  }

  async getIndicatorsByCategory(
    categoryName: string,
    importanceMin?: number,
  ): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (importanceMin) {
        params.append('importance_min', importanceMin.toString());
      }

      const response = await axios.get(
        `${this.dataIngestionServiceUrl}/api/v1/indicators?category_name=${categoryName}&${params.toString()}`,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get indicators: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get indicators: ${error.message}`);
    }
  }

  async getAllETLJobs(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.dataIngestionServiceUrl}/api/v1/etl/jobs`,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get all ETL jobs: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to get all ETL jobs: ${error.message}`);
    }
  }

  async importAndFetchCategory(
    categoryName: string,
    startDate?: string,
    endDate?: string,
    importanceMin?: number,
  ): Promise<any> {
    try {
      this.logger.log(
        `Import and fetch pipeline for category: ${categoryName}`,
      );

      // Call Python service endpoint that does everything
      const response = await axios.post(
        `${this.dataIngestionServiceUrl}/api/v1/bulk/import-and-fetch-category`,
        {
          category_name: categoryName,
          excel_path:
            'services/nff-data-ingestion/src/data/NFF_Indicators.xlsx',
          start_date: startDate || '2000-01-01',
          end_date: endDate || new Date().toISOString().split('T')[0],
          importance_min: importanceMin || 1,
        },
        {
          timeout: 300000, // 5 minutes for complete pipeline
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to import and fetch category: ${error.message}`,
        error.stack,
      );
      throw new Error(
        `Import and fetch failed for ${categoryName}: ${error.message}`,
      );
    }
  }

  async checkExcelFileExists(excelPath: string): Promise<{
    exists: boolean;
    fileSize?: number;
    lastModified?: string;
  }> {
    try {
      this.logger.log(`Checking Excel file accessibility: ${excelPath}`);

      const response = await axios.head(excelPath, {
        timeout: 10000,
        headers: {
          'User-Agent': 'NFF-Auto-Report/1.0',
        },
      });

      const fileSize = response.headers['content-length']
        ? parseInt(response.headers['content-length'], 10)
        : undefined;

      const lastModified = response.headers['last-modified'];

      return {
        exists: true,
        fileSize,
        lastModified,
      };
    } catch (error) {
      this.logger.warn(
        `Excel file not accessible at ${excelPath}: ${error.message}`,
      );
      return {
        exists: false,
      };
    }
  }

  async cleanETLTables(): Promise<{
    etlLogs: number;
    timeSeries: number;
    reportDefaults: number;
    indicators: number;
    etlJobs: number;
  }> {
    try {
      this.logger.log('Starting ETL tables cleanup...');

      const deletedETLLogs = await this.prisma.indicatorETLLog.deleteMany({});
      const deletedTimeSeries =
        await this.prisma.indicatorTimeSeries.deleteMany({});
      const deletedReportDefaults =
        await this.prisma.indicatorReportDefault.deleteMany({});
      const deletedIndicators = await this.prisma.indicatorMetadata.deleteMany(
        {},
      );
      const deletedETLJobs = await this.prisma.eTLJob.deleteMany({});

      const result = {
        etlLogs: deletedETLLogs.count,
        timeSeries: deletedTimeSeries.count,
        reportDefaults: deletedReportDefaults.count,
        indicators: deletedIndicators.count,
        etlJobs: deletedETLJobs.count,
      };

      this.logger.log(`Cleanup completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to clean ETL tables: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
