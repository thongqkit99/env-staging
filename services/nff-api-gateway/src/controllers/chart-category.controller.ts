import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  ParseBoolPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChartCategoryService } from '../services/chart-category.service';
import {
  CreateChartCategoryDto,
  UpdateChartCategoryDto,
} from '../dto/chart-category.dto';

@ApiTags('Chart Categories')
@Controller('chart-categories')
export class ChartCategoryController {
  constructor(private readonly chartCategoryService: ChartCategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all chart categories' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive categories',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Chart categories retrieved successfully',
  })
  async findAll(
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
  ) {
    return this.chartCategoryService.findAll(includeInactive || false);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get chart category statistics' })
  @ApiResponse({
    status: 200,
    description: 'Category statistics retrieved successfully',
  })
  async getStats() {
    return this.chartCategoryService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single chart category by ID' })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'Chart category ID',
    example: 1,
  })
  @ApiQuery({
    name: 'includeIndicators',
    required: false,
    type: Boolean,
    description: 'Include associated indicators',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Chart category retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Chart category not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Query('includeIndicators', new ParseBoolPipe({ optional: true }))
    includeIndicators?: boolean,
  ) {
    return this.chartCategoryService.findOne(id, includeIndicators || false);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new chart category' })
  @ApiResponse({
    status: 201,
    description: 'Chart category created successfully',
  })
  @ApiResponse({
    status: 409,
    description: 'Chart category with the same name already exists',
  })
  async create(@Body() createDto: CreateChartCategoryDto) {
    return this.chartCategoryService.create(createDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing chart category' })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'Chart category ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Chart category updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Chart category not found' })
  @ApiResponse({
    status: 409,
    description: 'Chart category with the same name already exists',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateChartCategoryDto,
  ) {
    return this.chartCategoryService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a chart category (soft delete by default)',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'Chart category ID',
    example: 1,
  })
  @ApiQuery({
    name: 'hardDelete',
    required: false,
    type: Boolean,
    description: 'Permanently delete the category',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Chart category deleted/deactivated successfully',
  })
  @ApiResponse({ status: 404, description: 'Chart category not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete category with associated indicators',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('hardDelete', new ParseBoolPipe({ optional: true }))
    hardDelete?: boolean,
  ) {
    return this.chartCategoryService.remove(id, hardDelete || false);
  }

  @Put(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted chart category' })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'Chart category ID',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Chart category restored successfully',
  })
  @ApiResponse({ status: 404, description: 'Chart category not found' })
  @ApiResponse({
    status: 400,
    description: 'Chart category is already active',
  })
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.chartCategoryService.restore(id);
  }
}
