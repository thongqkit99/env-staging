import { Injectable, Logger } from '@nestjs/common';
import cache from 'memory-cache';
import puppeteer, { Page } from 'puppeteer';
import { TradingViewDto } from '../dto/tradingview.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class TradingViewService {
  private readonly logger = new Logger(TradingViewService.name);
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  private lastFetchTime: { [key: string]: number } = {};

  constructor(private readonly prisma: PrismaService) {}

  private parseMarketCap(str: string): number {
    if (!str) return 0;
    const match = str.match(/([\d.]+)\s*([MBT])\s*USD/i);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    const factor =
      unit === 'B' ? 1e9 : unit === 'M' ? 1e6 : unit === 'T' ? 1e12 : 1;
    return num * factor;
  }

  private async autoScroll(page: Page): Promise<void> {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 300);
      });
    });
  }

  async scrapeTradingView(url: string): Promise<TradingViewDto[]> {
    const now = Date.now();
    const cacheKey = `tradingViewData_${url}`;

    // Check if we have cached data and if it's still fresh
    const cachedData = cache.get(cacheKey);
    if (
      cachedData &&
      this.lastFetchTime[url] &&
      now - this.lastFetchTime[url] < this.CACHE_DURATION
    ) {
      this.logger.log('📦 Returning cached data');
      return cachedData;
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
      this.logger.log(`🔍 Navigating to: ${url}`);
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
      await page.goto(url, { waitUntil: 'networkidle2' });

      this.logger.log('📜 Scrolling to load all data...');
      await this.autoScroll(page);
      await new Promise((res) => setTimeout(res, 2000));

      this.logger.log('⏳ Waiting for tbody selector...');
      await page.waitForSelector('tbody', { timeout: 60000 });

      this.logger.log('📥 Extracting data...');
      const stocks: TradingViewDto[] = await page.evaluate(() => {
        const results: TradingViewDto[] = [];
        const rows = document.querySelectorAll('tbody > tr');

        rows.forEach((row) => {
          const tds = row.querySelectorAll('td');
          if (tds.length < 10) return;

          const dataRowKey = row.getAttribute('data-rowkey') || '';
          const symbol = (
            dataRowKey.includes(':') ? dataRowKey.split(':')[1] : dataRowKey
          ).trim();
          const companyName = tds[0].textContent?.trim().split('\n')[0] || '';
          const preMarketChangePercent = tds[1].textContent?.trim() || '';
          const marketCap = tds[9].textContent?.trim() || '';

          results.push({
            symbol,
            companyName,
            preMarketChangePercent,
            marketCap,
          });
        });

        return results;
      });

      this.logger.log(`✅ Scraped ${stocks.length} rows from page`);

      const filtered = stocks.filter((s) => {
        const cap = this.parseMarketCap(s.marketCap);
        return cap >= 1.5e9;
      });

      this.logger.log(`📊 Filtered stocks: ${filtered.length}`);
      if (filtered.length === 0) {
        this.logger.warn('⚠️ No stocks matched the filter (cap > 1.5B)');
      }

      // Update cache and last fetch time
      cache.put(cacheKey, filtered, this.CACHE_DURATION);
      this.lastFetchTime[url] = now;

      await browser.close();
      return filtered;
    } catch (err) {
      this.logger.error('❌ SCRAPING ERROR:', err);
      await browser.close();
      throw err;
    }
  }

  async getTradingViewData(url: string): Promise<TradingViewDto[]> {
    try {
      return await this.scrapeTradingView(url);
    } catch (error) {
      this.logger.error('Failed to scrape trading view data:', error);
      throw new Error('Failed to scrape trading view data');
    }
  }

  // Lưu data vào database với data_type để phân biệt
  async storeTradingViewStocks(
    stocks: TradingViewDto[],
    dataType: 'gainers' | 'losers',
  ): Promise<void> {
    const fetchTime = new Date();

    try {
      // 1. CLEAR DB CŨ - Xóa data cũ theo loại (gainers hoặc losers)
      await this.prisma.tradingViewStock.deleteMany({
        where: { dataType: dataType },
      });

      this.logger.log(`🗑️ Cleared old ${dataType} data`);

      // 2. LƯU DATA MỚI - Tạo record mới cho data mới
      for (const stock of stocks) {
        await this.prisma.tradingViewStock.create({
          data: {
            symbol: stock.symbol,
            companyName: stock.companyName,
            preMarketChangePercent: stock.preMarketChangePercent,
            marketCap: stock.marketCap,
            source: 'tradingview',
            dataType: dataType, // 'gainers' or 'losers'
            fetchTime: fetchTime,
          },
        });
      }

      this.logger.log(
        `💾 Stored ${stocks.length} ${dataType} stocks to database`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to store ${dataType} stocks:`, error);
      throw error;
    }
  }

  // Lấy data từ database theo loại
  async getStocksByType(
    dataType: 'gainers' | 'losers',
  ): Promise<TradingViewDto[]> {
    try {
      const stocks = await this.prisma.tradingViewStock.findMany({
        where: { dataType: dataType },
        orderBy: { fetchTime: 'desc' },
      });

      return stocks.map((stock) => ({
        symbol: stock.symbol,
        companyName: stock.companyName,
        preMarketChangePercent: stock.preMarketChangePercent ?? '',
        marketCap: stock.marketCap ?? '',
      }));
    } catch (error) {
      this.logger.error(
        `❌ Failed to get ${dataType} stocks from database:`,
        error,
      );
      throw error;
    }
  }

  // Lấy tất cả data từ database
  async getAllStocks(): Promise<TradingViewDto[]> {
    try {
      const stocks = await this.prisma.tradingViewStock.findMany({
        orderBy: { fetchTime: 'desc' },
      });

      return stocks.map((stock) => ({
        symbol: stock.symbol,
        companyName: stock.companyName,
        preMarketChangePercent: stock.preMarketChangePercent ?? '',
        marketCap: stock.marketCap ?? '',
      }));
    } catch (error) {
      this.logger.error('❌ Failed to get all stocks from database:', error);
      throw error;
    }
  }
}
