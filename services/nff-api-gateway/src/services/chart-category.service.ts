import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import {
  CreateChartCategoryDto,
  UpdateChartCategoryDto,
} from '../dto/chart-category.dto';

@Injectable()
export class ChartCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all chart categories
   */
  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };

    const categories = await this.prisma.chartCategory.findMany({
      where,
      include: {
        _count: {
          select: {
            indicators: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      data: categories,
      total: categories.length,
    };
  }

  /**
   * Get a single chart category by ID
   */
  async findOne(id: number, includeIndicators = false) {
    const category = await this.prisma.chartCategory.findUnique({
      where: { id },
      include: {
        indicators: includeIndicators
          ? {
              where: { isActive: true },
              orderBy: { indicatorEN: 'asc' },
            }
          : false,
        _count: {
          select: {
            indicators: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Chart category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Create a new chart category
   */
  async create(createDto: CreateChartCategoryDto) {
    // Check if category with same name already exists
    const existingCategory = await this.prisma.chartCategory.findUnique({
      where: { name: createDto.name },
    });

    if (existingCategory) {
      throw new ConflictException(
        `Chart category with name "${createDto.name}" already exists`,
      );
    }

    const category = await this.prisma.chartCategory.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        icon: createDto.icon,
        isActive: createDto.isActive ?? true,
      },
      include: {
        _count: {
          select: {
            indicators: true,
          },
        },
      },
    });

    return category;
  }

  /**
   * Update an existing chart category
   */
  async update(id: number, updateDto: UpdateChartCategoryDto) {
    // Check if category exists
    await this.findOne(id);

    // If updating name, check for conflicts
    if (updateDto.name) {
      const existingCategory = await this.prisma.chartCategory.findUnique({
        where: { name: updateDto.name },
      });

      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException(
          `Chart category with name "${updateDto.name}" already exists`,
        );
      }
    }

    const category = await this.prisma.chartCategory.update({
      where: { id },
      data: {
        name: updateDto.name,
        description: updateDto.description,
        icon: updateDto.icon,
        isActive: updateDto.isActive,
      },
      include: {
        _count: {
          select: {
            indicators: true,
          },
        },
      },
    });

    return category;
  }

  /**
   * Delete a chart category (soft delete by setting isActive to false)
   */
  async remove(id: number, hardDelete = false) {
    // Check if category exists
    const category = await this.findOne(id);

    // Check if category has indicators
    const indicatorCount = await this.prisma.indicatorMetadata.count({
      where: { categoryId: id },
    });

    if (indicatorCount > 0 && hardDelete) {
      throw new BadRequestException(
        `Cannot delete category with ${indicatorCount} associated indicators. Please remove or reassign indicators first.`,
      );
    }

    if (hardDelete) {
      await this.prisma.chartCategory.delete({
        where: { id },
      });

      return {
        message: `Chart category "${category.name}" has been permanently deleted`,
        deleted: true,
      };
    } else {
      // Soft delete
      await this.prisma.chartCategory.update({
        where: { id },
        data: { isActive: false },
      });

      return {
        message: `Chart category "${category.name}" has been deactivated`,
        deleted: false,
      };
    }
  }

  /**
   * Restore a soft-deleted category
   */
  async restore(id: number) {
    const category = await this.prisma.chartCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Chart category with ID ${id} not found`);
    }

    if (category.isActive) {
      throw new BadRequestException(
        `Chart category "${category.name}" is already active`,
      );
    }

    const restoredCategory = await this.prisma.chartCategory.update({
      where: { id },
      data: { isActive: true },
      include: {
        _count: {
          select: {
            indicators: true,
          },
        },
      },
    });

    return restoredCategory;
  }

  /**
   * Get category statistics
   */
  async getStats() {
    const [total, active, inactive, withIndicators] = await Promise.all([
      this.prisma.chartCategory.count(),
      this.prisma.chartCategory.count({ where: { isActive: true } }),
      this.prisma.chartCategory.count({ where: { isActive: false } }),
      this.prisma.chartCategory.count({
        where: {
          indicators: {
            some: {},
          },
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      withIndicators,
      withoutIndicators: total - withIndicators,
    };
  }
}
