import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ScrapeTradingViewDto, TradingViewDto } from '../dto/tradingview.dto';
import { TradingViewService } from '../services/tradingview.service';

@Controller('tradingview')
export class TradingViewController {
  private readonly logger = new Logger(TradingViewController.name);

  constructor(private readonly tradingViewService: TradingViewService) {}

  @Post('scrape')
  async scrapeTradingView(
    @Body() scrapeTradingViewDto: ScrapeTradingViewDto,
  ): Promise<TradingViewDto[]> {
    this.logger.log(
      `Starting trading view scraping for URL: ${scrapeTradingViewDto.url}`,
    );
    return await this.tradingViewService.getTradingViewData(
      scrapeTradingViewDto.url,
    );
  }

  @Get('scrape')
  async scrapeTradingViewByQuery(
    @Query('url') url: string,
  ): Promise<TradingViewDto[]> {
    if (!url) {
      throw new Error('URL query parameter is required');
    }
    this.logger.log(`Starting trading view scraping for URL: ${url}`);
    return await this.tradingViewService.getTradingViewData(url);
  }

  @Get('pre-market-gainers')
  async getPreMarketGainers(): Promise<TradingViewDto[]> {
    try {
      const gainersUrl =
        'https://www.tradingview.com/markets/stocks-usa/market-movers-pre-market-gainers/';
      this.logger.log('Getting pre-market gainers from TradingView');

      // 1. Fetch data từ TradingView
      const stocks =
        await this.tradingViewService.getTradingViewData(gainersUrl);

      // 2. Lưu data vào database với dataType = 'gainers'
      await this.tradingViewService.storeTradingViewStocks(stocks, 'gainers');

      this.logger.log(
        `✅ Successfully fetched and stored ${stocks.length} gainers`,
      );
      return stocks;
    } catch (err: any) {
      this.logger.error('Error getting pre-market gainers:', err);
      throw new Error(
        `Error in getting pre-market gainers data: ${err?.message || 'Unknown error'}`,
      );
    }
  }

  @Get('pre-market-losers')
  async getPreMarketLosers(): Promise<TradingViewDto[]> {
    try {
      const losersUrl =
        'https://www.tradingview.com/markets/stocks-usa/market-movers-pre-market-losers/';
      this.logger.log('Getting pre-market losers from TradingView');

      // 1. Fetch data từ TradingView
      const stocks =
        await this.tradingViewService.getTradingViewData(losersUrl);

      // 2. Lưu data vào database với dataType = 'losers'
      await this.tradingViewService.storeTradingViewStocks(stocks, 'losers');

      this.logger.log(
        `✅ Successfully fetched and stored ${stocks.length} losers`,
      );
      return stocks;
    } catch (err: any) {
      this.logger.error('Error getting pre-market losers:', err);
      throw new Error(
        `Error in getting pre-market losers data: ${err?.message || 'Unknown error'}`,
      );
    }
  }

  // Endpoints để lấy data từ database
  @Get('database/gainers')
  async getGainersFromDatabase(): Promise<TradingViewDto[]> {
    try {
      this.logger.log('Getting gainers from database');
      return await this.tradingViewService.getStocksByType('gainers');
    } catch (err: any) {
      this.logger.error('Error getting gainers from database:', err);
      throw new Error(
        `Error in getting gainers from database: ${err?.message || 'Unknown error'}`,
      );
    }
  }

  @Get('database/losers')
  async getLosersFromDatabase(): Promise<TradingViewDto[]> {
    try {
      this.logger.log('Getting losers from database');
      return await this.tradingViewService.getStocksByType('losers');
    } catch (err: any) {
      this.logger.error('Error getting losers from database:', err);
      throw new Error(
        `Error in getting losers from database: ${err?.message || 'Unknown error'}`,
      );
    }
  }

  @Get('database/all')
  async getAllStocksFromDatabase(): Promise<TradingViewDto[]> {
    try {
      this.logger.log('Getting all stocks from database');
      return await this.tradingViewService.getAllStocks();
    } catch (err: any) {
      this.logger.error('Error getting all stocks from database:', err);
      throw new Error(
        `Error in getting all stocks from database: ${err?.message || 'Unknown error'}`,
      );
    }
  }
}
