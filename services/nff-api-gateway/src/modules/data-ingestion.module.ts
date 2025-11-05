import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataIngestionController } from '../controllers/data-ingestion.controller';
import { DataIngestionService } from '../services/data-ingestion.service';

@Module({
  imports: [ConfigModule],
  controllers: [DataIngestionController],
  providers: [DataIngestionService],
  exports: [DataIngestionService],
})
export class DataIngestionModule {}
