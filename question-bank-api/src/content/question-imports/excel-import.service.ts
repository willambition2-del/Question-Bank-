import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GradeLevel,
  QuestionDifficulty,
  QuestionReviewStatus,
  QuestionType,
} from '../../generated/prisma/enums';

export interface ExcelQuestionRow {
  rowNumber: number;
  questionText: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  options: Array<{ text: string; isCorrect: boolean; sortOrder: number }>;
  explanation?: string;
  isValid: boolean;
  errors: string[];
}

export interface ExcelImportPreview {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  gradeLevel: GradeLevel;
  subjectId: string;
  subjectName: string;
  rows: ExcelQuestionRow[];
}

@Injectable()
export class ExcelImportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateQuestionsTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'بنك الأسئلة';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('الأسئلة', {
      views: [{ rightToLeft: true }],
    });

    sheet.columns = [
      { header: 'م', key: 'id', width: 8 },
      { header: 'نص السؤال *', key: 'questionText', width: 45 },
      { header: 'نوع السؤال (اختيار من متعدد / صح وخطأ)', key: 'type', width: 25 },
      { header: 'الخيار 1 *', key: 'opt1', width: 25 },
      { header: 'الخيار 2 *', key: 'opt2', width: 25 },
      { header: 'الخيار 3', key: 'opt3', width: 25 },
      { header: 'الخيار 4', key: 'opt4', width: 25 },
      { header: 'رقم الإجابة الصحيحة (1-4) *', key: 'correct', width: 25 },
      { header: 'مستوى الصعوبة (سهل / متوسط / صعب)', key: 'difficulty', width: 25 },
      { header: 'الشرح والتفسير (اختياري)', key: 'explanation', width: 35 },
    ];

    // Header styling
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // dark blue
    };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    // Sample data rows
    sheet.addRow({
      id: 1,
      questionText: 'ما هي عاصمة الجمهورية اليمنية؟',
      type: 'اختيار من متعدد',
      opt1: 'صنعاء',
      opt2: 'عدن',
      opt3: 'تعز',
      opt4: 'الحديدة',
      correct: 1,
      difficulty: 'سهل',
      explanation: 'صنعاء هي العاصمة التاريخية والدستورية للجمهورية اليمنية.',
    });

    sheet.addRow({
      id: 2,
      questionText: 'يتكون جزيء الماء من ذرتي هيدروجين وذرة أكسجين.',
      type: 'صح وخطأ',
      opt1: 'صح',
      opt2: 'خطأ',
      opt3: '',
      opt4: '',
      correct: 1,
      difficulty: 'سهل',
      explanation: 'التركيب الكيميائي للماء هو H2O.',
    });

    sheet.addRow({
      id: 3,
      questionText: 'أي من العناصر التالية يعتبر غازاً نبيلاً؟',
      type: 'اختيار من متعدد',
      opt1: 'الهيدروجين',
      opt2: 'الهيليوم',
      opt3: 'النيتروجين',
      opt4: 'الأكسجين',
      correct: 2,
      difficulty: 'متوسط',
      explanation: 'الهيليوم من عناصر المجموعة الثامنة عشرة وهي الغازات النبيلة.',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateExamModelsTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'بنك الأسئلة';
    const sheet = workbook.addWorksheet('نموذج اختباري', {
      views: [{ rightToLeft: true }],
    });

    sheet.columns = [
      { header: 'رقم السؤال', key: 'id', width: 12 },
      { header: 'نص السؤال *', key: 'questionText', width: 45 },
      { header: 'الخيار 1 *', key: 'opt1', width: 25 },
      { header: 'الخيار 2 *', key: 'opt2', width: 25 },
      { header: 'الخيار 3', key: 'opt3', width: 25 },
      { header: 'الخيار 4', key: 'opt4', width: 25 },
      { header: 'رقم الإجابة الصحيحة (1-4) *', key: 'correct', width: 25 },
      { header: 'درجة السؤال (افتراضي 1)', key: 'points', width: 20 },
      { header: 'الشرح / التفسير', key: 'explanation', width: 35 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF065F46' }, // emerald green
    };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.addRow({
      id: 1,
      questionText: 'قيمة تسارع الجاذبية الأرضية تقريباً تساوي:',
      opt1: '9.8 م/ث²',
      opt2: '8.9 م/ث²',
      opt3: '10.5 م/ث²',
      opt4: '12 م/ث²',
      correct: 1,
      points: 1,
      explanation: 'تسارع السقوط الحر قرب سطح الأرض 9.8 m/s².',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async previewExcel(
    fileBuffer: Buffer,
    gradeLevel: GradeLevel,
    subjectId: string,
  ): Promise<ExcelImportPreview> {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        deletedAt: null,
        grade: { code: gradeLevel, deletedAt: null },
      },
      include: { grade: true },
    });

    if (!subject) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'SUBJECT_GRADE_MISMATCH',
        message: 'المادة المحددة لا تنتمي إلى الصف الدراسي المختار أو غير موجودة.',
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount <= 1) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'EMPTY_EXCEL_SHEET',
        message: 'ملف Excel فارغ أو لا يحتوي على صفوف بيانات.',
      });
    }

    const rows: ExcelQuestionRow[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const errors: string[] = [];
      const questionTextRaw = row.getCell(2).text?.trim();
      const typeRaw = row.getCell(3).text?.trim() || '';
      const opt1 = row.getCell(4).text?.trim() || '';
      const opt2 = row.getCell(5).text?.trim() || '';
      const opt3 = row.getCell(6).text?.trim() || '';
      const opt4 = row.getCell(7).text?.trim() || '';
      const correctRaw = row.getCell(8).text?.trim();
      const diffRaw = row.getCell(9).text?.trim();
      const explanation = row.getCell(10).text?.trim() || undefined;

      if (!questionTextRaw) {
        // Skip empty row if completely blank
        if (!opt1 && !opt2 && !correctRaw) return;
        errors.push('نص السؤال مطلوب');
      }

      // Determine question type
      let type: QuestionType = QuestionType.MULTIPLE_CHOICE;
      if (
        typeRaw.includes('صح') ||
        typeRaw.includes('TRUE') ||
        typeRaw.includes('خطأ')
      ) {
        type = QuestionType.TRUE_FALSE;
      }

      // Options parsing
      const rawOptions: string[] = [];
      if (type === QuestionType.TRUE_FALSE) {
        rawOptions.push(opt1 || 'صح');
        rawOptions.push(opt2 || 'خطأ');
      } else {
        if (opt1) rawOptions.push(opt1);
        if (opt2) rawOptions.push(opt2);
        if (opt3) rawOptions.push(opt3);
        if (opt4) rawOptions.push(opt4);

        if (rawOptions.length < 2) {
          errors.push('يجب توفير خيارين على الأقل لسؤال الاختيار من متعدد');
        }
      }

      // Correct option index (1-based)
      let correctIdx = parseInt(correctRaw, 10);
      if (isNaN(correctIdx) || correctIdx < 1 || correctIdx > rawOptions.length) {
        if (correctRaw === 'صح' || correctRaw === 'نعم' || correctRaw.toLowerCase() === 'true') {
          correctIdx = 1;
        } else if (correctRaw === 'خطأ' || correctRaw === 'لا' || correctRaw.toLowerCase() === 'false') {
          correctIdx = 2;
        } else {
          errors.push(`رقم الإجابة الصحيحة (${correctRaw}) غير صالح، يجب أن يكون بين 1 و ${rawOptions.length}`);
        }
      }

      // Difficulty parsing
      let difficulty: QuestionDifficulty = QuestionDifficulty.MEDIUM;
      if (diffRaw?.includes('سهل') || diffRaw?.toUpperCase() === 'EASY') {
        difficulty = QuestionDifficulty.EASY;
      } else if (diffRaw?.includes('صعب') || diffRaw?.toUpperCase() === 'HARD') {
        difficulty = QuestionDifficulty.HARD;
      }

      const options = rawOptions.map((text, idx) => ({
        text,
        isCorrect: idx + 1 === correctIdx,
        sortOrder: idx + 1,
      }));

      rows.push({
        rowNumber,
        questionText: questionTextRaw || '',
        type,
        difficulty,
        options,
        explanation,
        isValid: errors.length === 0,
        errors,
      });
    });

    const validRowsCount = rows.filter((r) => r.isValid).length;
    const invalidRowsCount = rows.length - validRowsCount;

    return {
      totalRows: rows.length,
      validRowsCount,
      invalidRowsCount,
      gradeLevel,
      subjectId,
      subjectName: subject.name,
      rows,
    };
  }

  async confirmImport(
    preview: ExcelImportPreview,
    actorId: string,
    unitId?: string,
    lessonId?: string,
  ) {
    const validRows = preview.rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'NO_VALID_ROWS',
        message: 'لا توجد أي أسئلة صالحة للاستيراد.',
      });
    }

    // Verify subject & cross-grade
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: preview.subjectId,
        deletedAt: null,
        grade: { code: preview.gradeLevel, deletedAt: null },
      },
    });

    if (!subject) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'SUBJECT_GRADE_MISMATCH',
        message: 'المادة المحددة لا تنتمي إلى الصف الدراسي المختار.',
      });
    }

    if (unitId) {
      const unit = await this.prisma.unit.findFirst({
        where: { id: unitId, subjectId: subject.id, deletedAt: null },
      });
      if (!unit) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'UNIT_MISMATCH',
          message: 'الوحدة المحددة لا تنتمي إلى المادة المختارة.',
        });
      }
    }

    if (lessonId) {
      const lesson = await this.prisma.lesson.findFirst({
        where: { id: lessonId, subjectId: subject.id, deletedAt: null },
      });
      if (!lesson) {
        throw new BadRequestException({
          statusCode: 400,
          code: 'LESSON_MISMATCH',
          message: 'الدرس المحدد لا ينتمي إلى المادة المختارة.',
        });
      }
    }

    let createdCount = 0;

    await this.prisma.$transaction(
      async (tx) => {
        for (const row of validRows) {
          await tx.question.create({
            data: {
              subjectId: preview.subjectId,
              unitId: unitId ?? null,
              lessonId: lessonId ?? null,
              createdById: actorId,
              questionText: row.questionText,
              type: row.type,
              difficulty: row.difficulty,
              explanationShort: row.explanation,
              explanationDetailed: row.explanation,
              reviewStatus: QuestionReviewStatus.READY,
              isActive: true,
              isPublished: true,
              options: {
                create: row.options.map((opt) => ({
                  optionText: opt.text,
                  isCorrect: opt.isCorrect,
                  sortOrder: opt.sortOrder,
                })),
              },
            },
          });
          createdCount++;
        }
      },
      { timeout: 60000 },
    );

    return {
      success: true,
      importedCount: createdCount,
      subjectName: subject.name,
      gradeLevel: preview.gradeLevel,
    };
  }
}