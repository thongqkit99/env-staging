import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import moment from 'moment-timezone';
import { LobstrService } from './lobstr.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TradingViewService } from './tradingview.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  private readonly scheduleConfigs = [
    {
      scheduleId: '3ad05df5458b44ab862b81d4f9d108dd',
      windowTime: '03:00',
    },
    {
      scheduleId: '73457dc6f5ae4da894e5c1610bbf9a06',
      windowTime: '11:00',
    },
    {
      scheduleId: 'a4e63ed9d96848748d2bdd91f534c504',
      windowTime: '14:00',
    },
    {
      scheduleId: 'e5f0850a18764aadbe08bd6c507ce26c',
      windowTime: '15:33',
    },
  ];

  private readonly pythonServiceUrl: string;

  constructor(
    private readonly lobstrService: LobstrService,
    private readonly httpService: HttpService,
    private readonly tvService: TradingViewService,
  ) {
    this.pythonServiceUrl =
      process.env.PYTHON_SERVICE_URL ||
      process.env.DATA_INGESTION_SERVICE_URL ||
      'http://localhost:8000';
    this.logger.log(
      `[DEBUG] Python service URL configured: ${this.pythonServiceUrl}`,
    );
  }

  // Window time: 03:00
  @Cron('10 3 * * *', {
    timeZone: 'Asia/Jerusalem',
  })
  async handle0300Cron() {
    const time = moment().tz('Asia/Jerusalem');
    await this.executeScheduledTask(time.format('HH:mm'));
  }

  // Window time: 11:00
  @Cron('10 11 * * *', {
    timeZone: 'Asia/Jerusalem',
  })
  async handle1100Cron() {
    const time = moment().tz('Asia/Jerusalem');
    await this.executeScheduledTask(time.format('HH:mm'));
  }

  // Window time: 14:00
  @Cron('10 14 * * *', {
    timeZone: 'Asia/Jerusalem',
  })
  async handle1400Cron() {
    const time = moment().tz('Asia/Jerusalem');
    await this.executeScheduledTask(time.format('HH:mm'));
  }

  // Window time: 15:33
  @Cron('43 15 * * *', {
    timeZone: 'Asia/Jerusalem',
  })
  async handle1533Cron() {
    const time = moment().tz('Asia/Jerusalem');
    await this.executeScheduledTask(time.format('HH:mm'));
  }

  // TEST CRON JOB - Every 3 minutes for testing (executes real 14:00 schedule)
  // @Cron('*/10 * * * *', {
  //   timeZone: 'Asia/Jerusalem',
  // })
  // async handleTestCron() {
  //   const time = moment().tz('Asia/Jerusalem');
  //   this.logger.log(
  //     `🧪 [TEST CRON] Running test cron job at ${time.format('YYYY-MM-DD HH:mm:ss')} (Asia/Jerusalem)`,
  //   );

  //   try {
  //     this.logger.log(`🧪 [TEST CRON] Executing REAL 15:33 schedule task...`);
  //     await this.executeScheduledTask('14:00');
  //     this.logger.log(`🧪 [TEST CRON] Real 14:00 schedule task completed`);
  //   } catch (error) {
  //     this.logger.error(`🧪 [TEST CRON] Real schedule task failed:`, error);
  //   }
  // }

  getWindowTimeByScheduleId(scheduleId: string): string | null {
    const config = this.scheduleConfigs.find(
      (c) => c.scheduleId === scheduleId,
    );
    return config ? config.windowTime : null;
  }

  async triggerManualFetch(scheduleId: string) {
    const windowTime = this.getWindowTimeByScheduleId(scheduleId);
    if (!windowTime) {
      this.logger.error(
        `[MANUAL] No window time found for schedule ID: ${scheduleId}`,
      );
      throw new Error(
        `Schedule ID ${scheduleId} not found in schedule configurations`,
      );
    }
    this.logger.log(
      `[MANUAL] Triggering manual fetch for schedule ${scheduleId} (window: ${windowTime})`,
    );
    return this.executeScheduledTask(windowTime);
  }

  private async executeScheduledTask(scheduleTime: string) {
    try {
      const config = this.scheduleConfigs.find(
        (c) => c.windowTime === scheduleTime,
      );
      if (!config) {
        this.logger.log(
          `[DEBUG] No configuration found for window time: ${scheduleTime}`,
        );
        return;
      }

      this.logger.log(
        `[DEBUG] Processing schedule ${config.scheduleId} for window ${scheduleTime}`,
      );

      this.logger.log(`[DEBUG] Calling Lobstr API getRunsList...`);
      const runsResponse = await this.lobstrService.getRunsList(
        config.scheduleId,
      );
      this.logger.log(`[DEBUG] Lobstr API response received`);

      if (!runsResponse.data || runsResponse.data.length === 0) {
        this.logger.log(
          `[DEBUG] No runs found for schedule ${config.scheduleId}`,
        );
        return;
      }

      const latestRun = runsResponse.data[0];
      this.logger.log(
        `[DEBUG] Latest run: ${latestRun.id}, Export count: ${latestRun.export_count || 0}`,
      );

      this.logger.log(
        `[DEBUG] Attempting to download file for run ${latestRun.id} regardless of export_count`,
      );

      this.logger.log(`[DEBUG] Downloading file for run ${latestRun.id}`);

      const runIdString = String(latestRun.id);

      let downloadUrl: string;
      try {
        const downloadResponse =
          await this.lobstrService.downloadRun(runIdString);

        downloadUrl = downloadResponse.download_url || downloadResponse.s3;
        this.logger.log(`[DEBUG] Download URL: ${downloadUrl}`);

        if (!downloadUrl) {
          this.logger.log(
            `[DEBUG] No download URL available for run ${runIdString}, skipping`,
          );
          return;
        }
      } catch (error) {
        this.logger.log(
          `[DEBUG] Failed to get download URL for run ${runIdString}: ${error.message}`,
        );
        return;
      }

      this.logger.log(`[DEBUG] Calling Python service for processing`);
      this.logger.log(`[DEBUG] Python service URL: ${this.pythonServiceUrl}`);
      this.logger.log(
        `[DEBUG] Request payload: ${JSON.stringify({
          download_url: downloadUrl,
          schedule_id: config.scheduleId,
          run_id: runIdString,
        })}`,
      );

      const response = await this.processRawDataViaPython(
        downloadUrl,
        config.scheduleId,
        runIdString,
      );

      this.logger.log(
        `[DEBUG] Python service response: ${JSON.stringify(response.data)}`,
      );

      await this.triggerEnrichmentPipeline(runIdString);

      this.logger.log(
        `[DEBUG] Successfully processed run ${latestRun.id} for window ${scheduleTime}`,
      );
    } catch (error) {
      this.logger.error(
        `[DEBUG] Error executing scheduled task for ${scheduleTime}:`,
        error,
      );
    }
  }

  private async processRawDataViaPython(
    downloadUrl: string,
    scheduleId: string,
    runId: string,
  ) {
    const response = await firstValueFrom(
      this.httpService.post(`${this.pythonServiceUrl}/api/v1/lobstr/process`, {
        download_url: downloadUrl,
        schedule_id: scheduleId,
        run_id: runId,
      }),
    );
    return response;
  }

  private async triggerEnrichmentPipeline(runId: string) {
    try {
      this.logger.log(
        `[DEBUG] Triggering enrichment pipeline for run ${runId}`,
      );

      const gainersUrl =
        'https://www.tradingview.com/markets/stocks-usa/market-movers-pre-market-gainers/';
      const losersUrl =
        'https://www.tradingview.com/markets/stocks-usa/market-movers-pre-market-losers/';
      const [gainers, losers] = await Promise.all([
        this.tvService.getTradingViewData(gainersUrl),
        this.tvService.getTradingViewData(losersUrl),
      ]);
      const marketContext = { gainers, losers };
      const enrichmentResponse = await firstValueFrom(
        this.httpService.post(
          `${this.pythonServiceUrl}/api/v1/enrichment/process`,
          {
            run_id: runId,
            market_context: marketContext,
          },
        ),
      );

      this.logger.log(
        `[DEBUG] Enrichment completed: ${enrichmentResponse.data.processed_count} tweets processed`,
      );

      const catalystResponse = await firstValueFrom(
        this.httpService.post(
          `${this.pythonServiceUrl}/api/v1/catalyst/group`,
          {
            time_window_hours: 6,
          },
        ),
      );

      this.logger.log(
        `[DEBUG] Catalyst grouping completed: ${catalystResponse.data.catalysts_created} catalysts created`,
      );
    } catch (error) {
      this.logger.error(
        `[DEBUG] Enrichment pipeline failed for run ${runId}:`,
        error,
      );
    }
  }
}
