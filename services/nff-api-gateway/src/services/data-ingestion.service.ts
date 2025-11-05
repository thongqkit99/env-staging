import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';

export interface MacroImportResponse {
  success: boolean;
  message: string;
  records_imported: number;
  stats?: {
    total_in_database: number;
    unique_indicators: number;
    priority_breakdown: Record<string, number>;
    source_breakdown: Record<string, number>;
  };
  source_file?: string;
  total_in_source?: number;
  errors_in_source?: number;
}

export interface MacroImportStatus {
  status: string;
  message: string;
  started_at?: string;
  completed_at?: string;
}

export interface MacroSourceValidation {
  file_exists: boolean;
  total_records: number;
  successful_indicators: number;
  failed_indicators: number;
  errors_count: number;
  file_path: string;
  export_timestamp?: string;
}

@Injectable()
export class DataIngestionService {
  private readonly logger = new Logger(DataIngestionService.name);
  private readonly httpClient: AxiosInstance;
  private readonly dataIngestionBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.dataIngestionBaseUrl =
      this.configService.get<string>('DATA_INGESTION_SERVICE_URL') ||
      this.configService.get<string>('PYTHON_SERVICE_URL') ||
      process.env.PYTHON_SERVICE_URL ||
      'http://localhost:8000';

    this.logger.log(`Data ingestion service URL: ${this.dataIngestionBaseUrl}`);

    this.httpClient = axios.create({
      baseURL: this.dataIngestionBaseUrl,
      timeout: 300000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(
          `Making request to: ${config.method?.toUpperCase()} ${config.url}`,
        );
        return config;
      },
      (error) => {
        this.logger.error(`Request error: ${error.message}`);
        return Promise.reject(new Error(error.message || 'Request failed'));
      },
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(
          `Response received: ${response.status} ${response.statusText}`,
        );
        return response;
      },
      (error) => {
        this.logger.error(
          `Response error: ${error.response?.status} ${error.response?.statusText}`,
        );
        return Promise.reject(new Error(error.message || 'Request failed'));
      },
    );
  }

  async runMacroImport(): Promise<MacroImportResponse> {
    try {
      this.logger.log('Starting macro indicators import...');

      const response: AxiosResponse<MacroImportResponse> =
        await this.httpClient.post('/macro-import/run');

      this.logger.log(
        `Import completed successfully: ${response.data.records_imported} records imported`,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to run macro import', error);
      throw this.handleHttpError(error, 'Failed to run macro import');
    }
  }

  async runMacroImportAsync(): Promise<{
    message: string;
    status: string;
    check_status_endpoint: string;
  }> {
    try {
      this.logger.log('Starting macro indicators import in background...');

      const response = await this.httpClient.post('/macro-import/run-async');

      this.logger.log('Background import started successfully');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to start background macro import', error);
      throw this.handleHttpError(error, 'Failed to start background import');
    }
  }
  async getImportStatus(): Promise<MacroImportStatus> {
    try {
      const response: AxiosResponse<MacroImportStatus> =
        await this.httpClient.get('/macro-import/status');

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get import status', error);
      throw this.handleHttpError(error, 'Failed to get import status');
    }
  }

  async getLastImportResult(): Promise<MacroImportResponse> {
    try {
      const response: AxiosResponse<MacroImportResponse> =
        await this.httpClient.get('/macro-import/last-result');

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get last import result', error);
      throw this.handleHttpError(error, 'Failed to get last import result');
    }
  }

  async validateSourceFile(): Promise<MacroSourceValidation> {
    try {
      this.logger.log('Validating macro indicators source file...');

      const response: AxiosResponse<MacroSourceValidation> =
        await this.httpClient.get('/macro-import/validate-source');

      this.logger.log(
        `Source file validation: ${response.data.total_records} total records`,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to validate source file', error);
      throw this.handleHttpError(error, 'Failed to validate source file');
    }
  }

  async checkImportServiceHealth(): Promise<{
    status: string;
    source_file_exists: boolean;
    source_file_path: string;
    current_import_status: string;
  }> {
    try {
      const response = await this.httpClient.get('/macro-import/health');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to check import service health', error);
      throw this.handleHttpError(
        error,
        'Failed to check import service health',
      );
    }
  }

  async checkServiceAvailability(): Promise<boolean> {
    try {
      this.logger.log(
        `Checking service availability at: ${this.dataIngestionBaseUrl}/health`,
      );
      const response = await this.httpClient.get('/health', { timeout: 5000 });
      this.logger.log(`Service availability check result: ${response.status}`);
      return response.status === 200;
    } catch (error) {
      this.logger.error(`Service availability check failed: ${error.message}`);
      return false;
    }
  }

  async getServiceInfo(): Promise<any> {
    try {
      const response = await this.httpClient.get('/');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get service info', error);
      throw this.handleHttpError(error, 'Failed to get service info');
    }
  }

  private handleHttpError(error: any, defaultMessage: string): HttpException {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const message = axiosError.response.statusText || defaultMessage;

        this.logger.error(`HTTP Error ${status}: ${message}`);

        switch (status) {
          case 404:
            return new HttpException(message, HttpStatus.NOT_FOUND);
          case 409:
            return new HttpException(message, HttpStatus.CONFLICT);
          case 500:
            return new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
          default:
            return new HttpException(message, status);
        }
      } else if (axiosError.request) {
        this.logger.error('No response received from data ingestion service');
        return new HttpException(
          'Data ingestion service is unavailable',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }

    this.logger.error(`Unknown error: ${error.message}`);
    return new HttpException(
      error.message || defaultMessage,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
