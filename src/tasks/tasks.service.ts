import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import {
  DIFFICULTY_XP,
  buildReport,
  computeStreaks,
  dayKey,
  levelFromXp,
} from './tasks.utils';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // Missões ainda não concluídas: as concluídas somem desta lista.
  async listActive(userId: number) {
    const today = dayKey(new Date());
    const tasks = await this.prisma.task.findMany({
      where: { userId, done: false },
      orderBy: [{ day: 'asc' }, { createdAt: 'asc' }],
    });
    return {
      today,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        difficulty: t.difficulty,
        xp: t.xp,
        day: t.day,
        overdue: t.day < today,
      })),
      stats: await this.stats(userId, today),
    };
  }

  async create(userId: number, dto: CreateTaskDto) {
    const difficulty = dto.difficulty ?? 'MEDIUM';
    return this.prisma.task.create({
      data: {
        userId,
        title: dto.title.trim(),
        difficulty,
        xp: DIFFICULTY_XP[difficulty],
        day: dto.day ?? dayKey(new Date()),
      },
    });
  }

  async complete(userId: number, id: number) {
    await this.own(userId, id);
    await this.prisma.task.update({
      where: { id },
      data: { done: true, doneAt: new Date() },
    });
    return this.stats(userId, dayKey(new Date()));
  }

  async reopen(userId: number, id: number) {
    await this.own(userId, id);
    await this.prisma.task.update({
      where: { id },
      data: { done: false, doneAt: null },
    });
    return this.stats(userId, dayKey(new Date()));
  }

  async remove(userId: number, id: number) {
    await this.own(userId, id);
    await this.prisma.task.delete({ where: { id } });
    return { ok: true };
  }

  async report(userId: number, days: number) {
    const today = dayKey(new Date());
    const since = new Date(Date.now() - (days + 1) * 24 * 60 * 60 * 1000);
    const done = await this.prisma.task.findMany({
      where: { userId, done: true, doneAt: { gte: since } },
    });
    const report = buildReport(
      done.map((t) => ({
        id: t.id,
        title: t.title,
        difficulty: t.difficulty,
        xp: t.xp,
        doneAt: t.doneAt as Date,
      })),
      days,
      today,
    );
    return { ...report, stats: await this.stats(userId, today) };
  }

  private async stats(userId: number, today: string) {
    const [doneAll, pending] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, done: true },
        select: { xp: true, doneAt: true },
      }),
      this.prisma.task.count({ where: { userId, done: false } }),
    ]);
    const days = doneAll.map((t) => dayKey(t.doneAt as Date));
    const totalXp = doneAll.reduce((sum, t) => sum + t.xp, 0);
    return {
      ...levelFromXp(totalXp),
      streak: computeStreaks(days, today),
      completedTotal: doneAll.length,
      completedToday: days.filter((d) => d === today).length,
      pending,
    };
  }

  private async own(userId: number, id: number) {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new NotFoundException('Missão não encontrada');
    return task;
  }
}
