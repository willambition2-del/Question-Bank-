import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Prisma } from '../../generated/prisma/client';
import { QuestionReviewStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
export type QuestionExportFormat = 'json' | 'csv' | 'xlsx';
@Injectable()
export class QuestionAdminReportingService {
  constructor(private readonly prisma: PrismaService) {}
  async quality() {
    const [
      total,
      ready,
      review,
      noExplanation,
      noHint,
      noLesson,
      noAnswer,
      types,
      difficulties,
      subjects,
      duplicates,
    ] = await Promise.all([
      this.prisma.question.count({ where: { deletedAt: null } }),
      this.prisma.question.count({
        where: { deletedAt: null, reviewStatus: QuestionReviewStatus.READY },
      }),
      this.prisma.question.count({
        where: {
          deletedAt: null,
          reviewStatus: QuestionReviewStatus.REVIEW_REQUIRED,
        },
      }),
      this.prisma.question.count({
        where: {
          deletedAt: null,
          explanationShort: null,
          explanationDetailed: null,
        },
      }),
      this.prisma.question.count({
        where: { deletedAt: null, hintText: null },
      }),
      this.prisma.question.count({
        where: { deletedAt: null, lessonId: null },
      }),
      this.prisma.question.count({
        where: {
          deletedAt: null,
          OR: [
            { type: 'TRUE_FALSE', correctBoolean: null },
            { type: 'MULTIPLE_CHOICE', options: { none: { isCorrect: true } } },
          ],
        },
      }),
      this.prisma.question.groupBy({
        by: ['type'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.question.groupBy({
        by: ['difficulty'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.subject.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          _count: { select: { questions: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM (SELECT fingerprint FROM "Question" WHERE fingerprint IS NOT NULL AND "deletedAt" IS NULL GROUP BY fingerprint HAVING COUNT(*) > 1) d`,
      ),
    ]);
    return {
      total,
      ready,
      requiresReview: review,
      missingAnswer: noAnswer,
      missingExplanation: noExplanation,
      missingHint: noHint,
      missingLesson: noLesson,
      probableDuplicateGroups: Number(duplicates[0]?.count ?? 0),
      byType: Object.fromEntries(types.map((x) => [x.type, x._count._all])),
      byDifficulty: Object.fromEntries(
        difficulties.map((x) => [x.difficulty, x._count._all]),
      ),
      bySubject: subjects.map((x) => ({
        id: x.id,
        name: x.name,
        count: x._count.questions,
      })),
    };
  }
  async export(actorId: string, format: QuestionExportFormat) {
    const max = Number(process.env.QUESTION_EXPORT_MAX_ROWS ?? 50000);
    const rows = await this.prisma.question.findMany({
      where: { deletedAt: null },
      include: {
        subject: { select: { name: true } },
        unit: { select: { name: true } },
        lesson: { select: { name: true } },
        source: { select: { name: true, year: true } },
        options: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: max,
    });
    const data = rows.map((q) => ({
      id: q.id,
      subject: q.subject.name,
      unit: q.unit?.name ?? '',
      lesson: q.lesson?.name ?? '',
      source: q.source?.name ?? '',
      year: q.source?.year ?? '',
      type: q.type,
      questionText: q.questionText,
      options: q.options.map((o) => o.optionText).join(' | '),
      correctAnswer:
        q.type === 'TRUE_FALSE'
          ? String(q.correctBoolean)
          : (q.options.find((o) => o.isCorrect)?.optionText ?? ''),
      hint: q.hintText ?? '',
      explanationShort: q.explanationShort ?? '',
      explanationDetailed: q.explanationDetailed ?? '',
      difficulty: q.difficulty,
      reviewStatus: q.reviewStatus,
      isPublished: q.isPublished,
    }));
    await this.prisma.questionExportAudit.create({
      data: {
        actorId,
        format,
        rowCount: data.length,
        filtersJson: { limit: max },
      },
    });
    if (format === 'json')
      return {
        buffer: Buffer.from(JSON.stringify(data, null, 2), 'utf8'),
        mime: 'application/json',
        name: 'questions-export.json',
        count: data.length,
      };
    if (format === 'csv') {
      const headers = Object.keys(data[0] ?? { id: '' });
      const cell = (v: unknown) => {
        let s =
          typeof v === 'string'
            ? v
            : typeof v === 'number' ||
                typeof v === 'boolean' ||
                typeof v === 'bigint'
              ? v.toString()
              : v instanceof Date
                ? v.toISOString()
                : '';
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
      };
      const csv =
        '\uFEFF' +
        headers.join(',') +
        '\n' +
        data
          .map((x) =>
            headers
              .map((h) => cell((x as Record<string, unknown>)[h]))
              .join(','),
          )
          .join('\n');
      return {
        buffer: Buffer.from(csv, 'utf8'),
        mime: 'text/csv; charset=utf-8',
        name: 'questions-export.csv',
        count: data.length,
      };
    }
    const wb = new ExcelJS.Workbook(),
      ws = wb.addWorksheet('Questions');
    ws.columns = Object.keys(data[0] ?? { id: '' }).map((key) => ({
      header: key,
      key,
      width: key.includes('question') || key.includes('explanation') ? 45 : 20,
    }));
    for (const row of data)
      ws.addRow(
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v,
          ]),
        ),
      );
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF173F5F' },
    };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    return {
      buffer: Buffer.from(await wb.xlsx.writeBuffer()),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      name: 'questions-export.xlsx',
      count: data.length,
    };
  }
}
