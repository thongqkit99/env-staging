import { Module } from '@nestjs/common';
import { ChartCategoryController } from '../controllers/chart-category.controller';
import { ChartCategoryService } from '../services/chart-category.service';
import { PrismaModule } from './prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ChartCategoryController],
  providers: [ChartCategoryService],
  exports: [ChartCategoryService],
})
export class ChartCategoryModule {}
