import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dayKey } from '../tasks/tasks.utils';
import { CreateHoldingDto, UpdateHoldingDto } from './dto/holding.dto';
import { RateService } from './rate.service';
import {
  DEFAULT_GOAL_DATE,
  DEFAULT_GOAL_USD,
  summarize,
} from './wealth.utils';

@Injectable()
export class WealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RateService,
  ) {}

  async summary(userId: number) {
    const rate = await this.rates.get();
    if (!rate) {
      throw new ServiceUnavailableException(
        'Não foi possível obter a cotação do dólar agora. Tente novamente em instantes.',
      );
    }
    const holdings = await this.prisma.holding.findMany({
      where: { userId },
      orderBy: [{ category: 'asc' }, { id: 'asc' }],
    });
    const goal = Number(process.env.WEALTH_GOAL_USD) || DEFAULT_GOAL_USD;
    const deadline = process.env.WEALTH_GOAL_DATE || DEFAULT_GOAL_DATE;
    return {
      ...summarize(holdings, rate.value, goal, dayKey(new Date()), deadline),
      rateInfo: { fetchedAt: rate.fetchedAt, stale: rate.stale },
    };
  }

  create(userId: number, dto: CreateHoldingDto) {
    return this.prisma.holding.create({
      data: {
        userId,
        category: dto.category,
        label: dto.label.trim(),
        amount: dto.amount,
        currency: dto.currency ?? 'BRL',
      },
    });
  }

  async update(userId: number, id: number, dto: UpdateHoldingDto) {
    await this.own(userId, id);
    return this.prisma.holding.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label.trim() }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
      },
    });
  }

  async remove(userId: number, id: number) {
    await this.own(userId, id);
    await this.prisma.holding.delete({ where: { id } });
    return { ok: true };
  }

  private async own(userId: number, id: number) {
    const found = await this.prisma.holding.findFirst({ where: { id, userId } });
    if (!found) throw new NotFoundException('Item não encontrado');
    return found;
  }
}
