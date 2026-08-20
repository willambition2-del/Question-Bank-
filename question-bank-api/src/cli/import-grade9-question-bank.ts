import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  QuestionType,
  QuestionDifficulty,
  QuestionReviewStatus,
  QuestionOrigin,
  SourceType,
} from '../generated/prisma/client';

dotenv.config();

// SQL Value parser helper
export function parseSqlValues(str: string): any[] {
  const values: any[] = [];
  let i = 0;
  const n = str.length;

  while (i < n && (str[i] === ' ' || str[i] === '(')) i++;

  while (i < n) {
    while (i < n && (str[i] === ' ' || str[i] === '\t')) i++;
    if (i >= n || str[i] === ')') break;

    if (str[i] === "'") {
      // String literal
      i++;
      let val = '';
      while (i < n) {
        if (str[i] === "'") {
          if (i + 1 < n && str[i + 1] === "'") {
            val += "'";
            i += 2;
          } else {
            i++;
            break;
          }
        } else if (str[i] === '\\' && i + 1 < n) {
          val += str[i + 1];
          i += 2;
        } else {
          val += str[i];
          i++;
        }
      }

      // Check for typecast e.g. ::jsonb
      if (i < n && str[i] === ':' && str[i + 1] === ':') {
        i += 2;
        while (i < n && /[a-zA-Z0-9_]/.test(str[i])) i++;
      }

      values.push(val);
    } else {
      // Unquoted literal: number, NULL, TRUE, FALSE
      let start = i;
      while (i < n && str[i] !== ',' && str[i] !== ')' && str[i] !== ';') {
        i++;
      }
      const raw = str.slice(start, i).trim();
      if (raw.toUpperCase() === 'NULL') {
        values.push(null);
      } else if (raw.toUpperCase() === 'TRUE') {
        values.push(true);
      } else if (raw.toUpperCase() === 'FALSE') {
        values.push(false);
      } else if (/^-?\d+$/.test(raw)) {
        values.push(parseInt(raw, 10));
      } else if (/^-?\d+\.\d+$/.test(raw)) {
        values.push(parseFloat(raw));
      } else {
        values.push(raw);
      }
    }

    while (i < n && (str[i] === ' ' || str[i] === '\t')) i++;
    if (i < n && str[i] === ',') i++;
  }

  return values;
}

interface SqlSubject {
  id: number;
  name_ar: string;
  name_en: string;
  grade: string;
}

interface SqlSource {
  id: number;
  subject_id: number;
  title: string;
  academic_year: string | null;
  source_type: string | null;
  governorate: string | null;
  original_file: string | null;
  metadata: any;
}

interface SqlPassage {
  id: number;
  subject_id: number;
  source_id: number | null;
  passage_text: string;
  status: string | null;
}

interface SqlQuestion {
  id: number;
  grade: string;
  subject_id: number;
  unit_id: number | null;
  lesson_id: number | null;
  source_id: number;
  passage_id: number | null;
  model_number: string | null;
  model_code: string | null;
  question_number: string | null;
  question_type: string;
  question_text: string;
  correct_answer: string | null;
  difficulty: string | null;
  expected_time_seconds: number | null;
  hint_text: string | null;
  explanation_short: string | null;
  explanation_detailed: string | null;
  fingerprint: string | null;
  tags: any;
  ai_generated: boolean;
  curriculum_match_score: number;
  review_required: boolean;
  source_reference: string | null;
  source_question_page: number | null;
  source_answer_page: number | null;
  notes: string | null;
  merged_from: any;
}

interface SqlOption {
  question_id: number;
  option_key: string | null;
  option_text: string;
  order: number;
  is_correct: boolean;
  why_wrong: string | null;
}

function parseYear(academicYear: string | null): number | null {
  if (!academicYear) return null;
  const match = academicYear.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1], 10) : null;
}

function mapSourceType(type: string | null): SourceType {
  if (!type) return SourceType.OTHER;
  const upper = type.toUpperCase();
  if (upper.includes('EXAM_MODEL') || upper.includes('MINISTRY_EXAM_MODEL')) {
    return SourceType.MINISTRY_MODEL;
  }
  if (upper.includes('EXAM') || upper.includes('MINISTERIAL')) {
    return SourceType.MINISTRY_EXAM;
  }
  if (upper.includes('TEXTBOOK')) {
    return SourceType.TEXTBOOK;
  }
  return SourceType.OTHER;
}

function mapDifficulty(diff: string | null): QuestionDifficulty {
  if (!diff) return QuestionDifficulty.MEDIUM;
  const upper = diff.toUpperCase();
  if (upper === 'EASY') return QuestionDifficulty.EASY;
  if (upper === 'HARD') return QuestionDifficulty.HARD;
  return QuestionDifficulty.MEDIUM;
}

export async function runGrade9Import(filePath: string, mode: 'DRY_RUN' | 'APPLY') {
  console.log(`==================================================`);
  console.log(`GRADE 9 QUESTION BANK IMPORTER`);
  console.log(`File: ${filePath}`);
  console.log(`Mode: ${mode}`);
  console.log(`==================================================\n`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found at: ${filePath}`);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Check database prerequisites
  const curriculum = await prisma.curriculum.findFirst({
    where: { slug: 'yemeni-curriculum' },
  });
  if (!curriculum) {
    throw new Error(`Yemeni curriculum not found!`);
  }

  const ninthGrade = await prisma.grade.findFirst({
    where: { code: 'NINTH' },
  });
  if (!ninthGrade) {
    throw new Error(`Grade with code 'NINTH' not found!`);
  }

  const thirdSecondaryGrade = await prisma.grade.findFirst({
    where: { code: 'THIRD_SECONDARY' },
  });

  const thirdSecondaryQuestionsBefore = thirdSecondaryGrade
    ? await prisma.question.count({ where: { subject: { gradeId: thirdSecondaryGrade.id } } })
    : 0;
  const ninthQuestionsBefore = await prisma.question.count({
    where: { subject: { gradeId: ninthGrade.id } },
  });
  const totalQuestionsBefore = await prisma.question.count();
  const totalOptionsBefore = await prisma.questionOption.count();

  console.log(`[PRE-IMPORT STATS]`);
  console.log(`- THIRD_SECONDARY Questions: ${thirdSecondaryQuestionsBefore}`);
  console.log(`- NINTH Questions: ${ninthQuestionsBefore}`);
  console.log(`- Total Questions: ${totalQuestionsBefore}`);
  console.log(`- Total Options: ${totalOptionsBefore}\n`);

  // 2. Parse SQL Dump file
  console.log(`Parsing SQL dump file...`);
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const sqlSubjects: SqlSubject[] = [];
  const sqlSources: SqlSource[] = [];
  const sqlPassages: SqlPassage[] = [];
  const sqlQuestions: SqlQuestion[] = [];
  const sqlOptions: SqlOption[] = [];
  let invalidRows = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('INSERT INTO ')) continue;

    const valuesIdx = trimmed.indexOf('VALUES');
    if (valuesIdx === -1) continue;
    const vStr = trimmed.slice(valuesIdx + 6).trim();

    if (trimmed.startsWith('INSERT INTO subjects')) {
      const vals = parseSqlValues(vStr);
      sqlSubjects.push({
        id: vals[0],
        name_ar: vals[1],
        name_en: vals[2],
        grade: vals[3],
      });
    } else if (trimmed.startsWith('INSERT INTO sources')) {
      const vals = parseSqlValues(vStr);
      sqlSources.push({
        id: vals[0],
        subject_id: vals[1],
        title: vals[2],
        academic_year: vals[3],
        source_type: vals[4],
        governorate: vals[5],
        original_file: vals[6],
        metadata: vals[7],
      });
    } else if (trimmed.startsWith('INSERT INTO reading_passages')) {
      const vals = parseSqlValues(vStr);
      sqlPassages.push({
        id: vals[0],
        subject_id: vals[1],
        source_id: vals[2],
        passage_text: vals[3],
        status: vals[4],
      });
    } else if (trimmed.startsWith('INSERT INTO questions')) {
      const vals = parseSqlValues(vStr);
      if (vals.length < 27) {
        console.error(`Invalid question row: ${trimmed.slice(0, 80)}`);
        invalidRows++;
        continue;
      }
      sqlQuestions.push({
        id: vals[0],
        grade: vals[1],
        subject_id: vals[2],
        unit_id: vals[3],
        lesson_id: vals[4],
        source_id: vals[5],
        passage_id: vals[6],
        model_number: vals[7],
        model_code: vals[8],
        question_number: vals[9],
        question_type: vals[10],
        question_text: vals[11],
        correct_answer: vals[12],
        difficulty: vals[13],
        expected_time_seconds: vals[14],
        hint_text: vals[15],
        explanation_short: vals[16],
        explanation_detailed: vals[17],
        fingerprint: vals[18],
        tags: vals[19],
        ai_generated: vals[20],
        curriculum_match_score: vals[21],
        review_required: vals[22],
        source_reference: vals[23],
        source_question_page: vals[24],
        source_answer_page: vals[25],
        notes: vals[26],
        merged_from: vals[29],
      });
    } else if (trimmed.startsWith('INSERT INTO question_options')) {
      const vals = parseSqlValues(vStr);
      sqlOptions.push({
        question_id: vals[0],
        option_key: vals[1],
        option_text: vals[2],
        order: vals[3],
        is_correct: vals[4],
        why_wrong: vals[5],
      });
    }
  }

  console.log(`[SQL DUMP PARSED]`);
  console.log(`- Subjects: ${sqlSubjects.length}`);
  console.log(`- Sources: ${sqlSources.length}`);
  console.log(`- Reading Passages: ${sqlPassages.length}`);
  console.log(`- Questions: ${sqlQuestions.length}`);
  console.log(`- Options: ${sqlOptions.length}`);
  console.log(`- Invalid Rows: ${invalidRows}\n`);

  // 3. Validation & Analytics
  const subjectDistribution: Record<string, number> = {};
  const subjectNameMap: Record<number, string> = {};
  for (const s of sqlSubjects) {
    subjectNameMap[s.id] = s.name_ar;
    subjectDistribution[s.name_ar] = 0;
  }

  let mcqCount = 0;
  let trueFalseCount = 0;
  let hintCount = 0;
  let explanationShortCount = 0;
  let explanationDetailedCount = 0;
  let difficultyCount = 0;
  let expectedTimeCount = 0;

  for (const q of sqlQuestions) {
    const sName = subjectNameMap[q.subject_id] || `Unknown (${q.subject_id})`;
    subjectDistribution[sName] = (subjectDistribution[sName] || 0) + 1;

    if (q.question_type === 'MCQ') mcqCount++;
    else if (q.question_type === 'TRUE_FALSE') trueFalseCount++;

    if (q.hint_text) hintCount++;
    if (q.explanation_short) explanationShortCount++;
    if (q.explanation_detailed) explanationDetailedCount++;
    if (q.difficulty) difficultyCount++;
    if (q.expected_time_seconds) expectedTimeCount++;
  }

  let correctMcqOptions = 0;
  let whyWrongCount = 0;
  const optionsByQuestionId = new Map<number, SqlOption[]>();
  for (const opt of sqlOptions) {
    if (!optionsByQuestionId.has(opt.question_id)) {
      optionsByQuestionId.set(opt.question_id, []);
    }
    optionsByQuestionId.get(opt.question_id)!.push(opt);

    if (opt.is_correct) correctMcqOptions++;
    if (opt.why_wrong) whyWrongCount++;
  }

  let mcqValidationErrors = 0;
  for (const q of sqlQuestions) {
    if (q.question_type === 'MCQ') {
      const opts = optionsByQuestionId.get(q.id) || [];
      const correctOpts = opts.filter((o) => o.is_correct);
      if (correctOpts.length !== 1) {
        console.error(`MCQ Question ID ${q.id} has ${correctOpts.length} correct options!`);
        mcqValidationErrors++;
      }
    }
  }

  console.log(`[CONTENT VERIFICATION & DISTRIBUTION]`);
  console.log(`- Subject Breakdown:`);
  for (const [sName, count] of Object.entries(subjectDistribution)) {
    console.log(`  * ${sName}: ${count}`);
  }
  console.log(`- Question Types: MCQ = ${mcqCount}, TRUE_FALSE = ${trueFalseCount}`);
  console.log(`- Correct MCQ Options: ${correctMcqOptions} (Expected: ${mcqCount})`);
  console.log(`- Educational Field Availability:`);
  console.log(`  * hintText: ${hintCount} / ${sqlQuestions.length}`);
  console.log(`  * explanationShort: ${explanationShortCount} / ${sqlQuestions.length}`);
  console.log(`  * explanationDetailed: ${explanationDetailedCount} / ${sqlQuestions.length}`);
  console.log(`  * difficulty: ${difficultyCount} / ${sqlQuestions.length}`);
  console.log(`  * expectedTimeSeconds: ${expectedTimeCount} / ${sqlQuestions.length}`);
  console.log(`  * whyWrong: ${whyWrongCount} / ${sqlOptions.length}\n`);

  if (mcqValidationErrors > 0) {
    throw new Error(`Validation failed: ${mcqValidationErrors} MCQ questions have invalid options!`);
  }

  if (mode === 'DRY_RUN') {
    console.log(`[DRY RUN COMPLETED SUCCESSFULLY]`);
    console.log(`No changes were written to the database.`);
    return {
      success: true,
      mode,
      subjectsToCreate: sqlSubjects.length,
      sourcesToCreate: sqlSources.length,
      passagesToCreate: sqlPassages.length,
      questionsToCreate: sqlQuestions.length,
      optionsToCreate: sqlOptions.length,
      invalidRows,
      subjectDistribution,
      mcqCount,
      trueFalseCount,
      correctMcqOptions,
    };
  }

  // 4. APPLY MODE: Database insertion
  console.log(`[APPLYING IMPORT TO DATABASE...]`);

  // Subject metadata mapping
  const subjectMetadata: Record<string, { slug: string; iconKey: string; colorHex: string; sortOrder: number }> = {
    'الاجتماعيات': { slug: 'social-studies', iconKey: 'book', colorHex: '#F59E0B', sortOrder: 1 },
    'التربية الإسلامية': { slug: 'islamic-studies', iconKey: 'book-open', colorHex: '#10B981', sortOrder: 2 },
    'العلوم': { slug: 'science', iconKey: 'flask', colorHex: '#3B82F6', sortOrder: 3 },
    'القرآن الكريم': { slug: 'quran', iconKey: 'book-marked', colorHex: '#059669', sortOrder: 4 },
    'اللغة الإنجليزية': { slug: 'english', iconKey: 'languages', colorHex: '#8B5CF6', sortOrder: 5 },
    'اللغة العربية': { slug: 'arabic', iconKey: 'feather', colorHex: '#EC4899', sortOrder: 6 },
  };

  const subjectIdMap = new Map<number, string>(); // oldId -> newUuid
  const sourceIdMap = new Map<number, string>(); // oldId -> newUuid
  const passageIdMap = new Map<number, string>(); // oldId -> newUuid
  const questionIdMap = new Map<number, string>(); // oldId -> newUuid

  // A. Create/Find Subjects for Grade 9
  console.log(`1. Upserting 6 Grade 9 Subjects...`);
  for (const s of sqlSubjects) {
    const meta = subjectMetadata[s.name_ar] || {
      slug: `subject-${s.id}`,
      iconKey: 'book',
      colorHex: '#6366F1',
      sortOrder: s.id,
    };

    let subject = await prisma.subject.findFirst({
      where: {
        curriculumId: curriculum.id,
        gradeId: ninthGrade.id,
        slug: meta.slug,
      },
    });

    if (!subject) {
      subject = await prisma.subject.create({
        data: {
          id: randomUUID(),
          curriculumId: curriculum.id,
          gradeId: ninthGrade.id,
          name: s.name_ar,
          slug: meta.slug,
          description: `منهج ${s.name_ar} للصف التاسع الأساسي`,
          iconKey: meta.iconKey,
          colorHex: meta.colorHex,
          sortOrder: meta.sortOrder,
          isActive: true,
          isPublished: true,
        },
      });
      console.log(`   + Created Subject: ${subject.name} (${subject.id})`);
    } else {
      console.log(`   = Found Existing Subject: ${subject.name} (${subject.id})`);
    }

    subjectIdMap.set(s.id, subject.id);
  }

  // B. Create Sources
  console.log(`2. Creating 31 Grade 9 Sources...`);
  for (const src of sqlSources) {
    const newSourceId = randomUUID();
    const parsedYear = parseYear(src.academic_year);
    const mappedType = mapSourceType(src.source_type);

    await prisma.source.create({
      data: {
        id: newSourceId,
        name: src.title,
        type: mappedType,
        year: parsedYear,
        governorate: src.governorate,
        description: src.original_file || `مصدر الصف التاسع - ${src.academic_year || ''}`,
        isOfficial: true,
        isActive: true,
      },
    });

    sourceIdMap.set(src.id, newSourceId);
  }
  console.log(`   + Created ${sourceIdMap.size} sources.`);

  // C. Create Reading Passages
  console.log(`3. Creating 13 Grade 9 Reading Passages...`);
  for (const p of sqlPassages) {
    const newPassageId = randomUUID();
    const targetSubjectId = subjectIdMap.get(p.subject_id);
    const targetSourceId = p.source_id ? sourceIdMap.get(p.source_id) : null;

    if (!targetSubjectId) {
      throw new Error(`Subject ID ${p.subject_id} not found in map for passage ${p.id}`);
    }

    await prisma.readingPassage.create({
      data: {
        id: newPassageId,
        subjectId: targetSubjectId,
        sourceId: targetSourceId,
        title: `Passage ${p.id}`,
        passageText: p.passage_text,
        languageCode: 'en',
        difficulty: QuestionDifficulty.MEDIUM,
        isActive: true,
        isPublished: true,
      },
    });

    passageIdMap.set(p.id, newPassageId);
  }
  console.log(`   + Created ${passageIdMap.size} reading passages.`);

  // D. Batch insert Questions (in chunks of 500)
  console.log(`4. Inserting 7917 Grade 9 Questions in chunks...`);
  const questionRecords: any[] = [];
  for (const q of sqlQuestions) {
    const newQuestionId = randomUUID();
    questionIdMap.set(q.id, newQuestionId);

    const targetSubjectId = subjectIdMap.get(q.subject_id);
    const targetSourceId = sourceIdMap.get(q.source_id);
    const targetPassageId = q.passage_id ? passageIdMap.get(q.passage_id) : null;

    if (!targetSubjectId || !targetSourceId) {
      throw new Error(`Subject or Source not mapped for question ${q.id}`);
    }

    questionRecords.push({
      id: newQuestionId,
      subjectId: targetSubjectId,
      unitId: null,
      lessonId: null,
      sourceId: targetSourceId,
      readingPassageId: targetPassageId,
      type: q.question_type === 'TRUE_FALSE' ? QuestionType.TRUE_FALSE : QuestionType.MULTIPLE_CHOICE,
      questionText: q.question_text,
      correctBoolean: q.question_type === 'TRUE_FALSE' ? q.correct_answer === 'TRUE' : null,
      hintText: q.hint_text,
      explanationShort: q.explanation_short,
      explanationDetailed: q.explanation_detailed,
      difficulty: mapDifficulty(q.difficulty),
      reviewStatus: QuestionReviewStatus.READY,
      origin: QuestionOrigin.IMPORTED,
      fingerprint: q.fingerprint,
      isTrapQuestion: false,
      isActive: true,
      isPublished: true,
      contentVersion: 1,
    });
  }

  const QUESTION_CHUNK_SIZE = 500;
  for (let i = 0; i < questionRecords.length; i += QUESTION_CHUNK_SIZE) {
    const chunk = questionRecords.slice(i, i + QUESTION_CHUNK_SIZE);
    await prisma.question.createMany({ data: chunk });
    process.stdout.write(`   + Questions inserted: ${Math.min(i + chunk.length, questionRecords.length)} / ${questionRecords.length}\r`);
  }
  console.log(`\n   + Successfully inserted all ${questionRecords.length} questions.`);

  // E. Batch insert Question Options (in chunks of 1000)
  console.log(`5. Inserting 17376 Question Options in chunks...`);
  const optionRecords: any[] = [];
  for (const opt of sqlOptions) {
    const targetQuestionId = questionIdMap.get(opt.question_id);
    if (!targetQuestionId) {
      throw new Error(`Question ID ${opt.question_id} not mapped for option!`);
    }

    optionRecords.push({
      id: randomUUID(),
      questionId: targetQuestionId,
      optionText: opt.option_text,
      sortOrder: opt.order,
      isCorrect: opt.is_correct,
      whyWrong: opt.why_wrong,
    });
  }

  const OPTION_CHUNK_SIZE = 1000;
  for (let i = 0; i < optionRecords.length; i += OPTION_CHUNK_SIZE) {
    const chunk = optionRecords.slice(i, i + OPTION_CHUNK_SIZE);
    await prisma.questionOption.createMany({ data: chunk });
    process.stdout.write(`   + Options inserted: ${Math.min(i + chunk.length, optionRecords.length)} / ${optionRecords.length}\r`);
  }
  console.log(`\n   + Successfully inserted all ${optionRecords.length} options.`);

  // 5. POST-IMPORT VERIFICATION
  console.log(`\n[POST-IMPORT DATABASE VERIFICATION]`);
  const ninthQuestionsAfter = await prisma.question.count({
    where: { subject: { gradeId: ninthGrade.id } },
  });
  const thirdSecondaryQuestionsAfter = thirdSecondaryGrade
    ? await prisma.question.count({ where: { subject: { gradeId: thirdSecondaryGrade.id } } })
    : 0;
  const totalQuestionsAfter = await prisma.question.count();
  const totalOptionsAfter = await prisma.questionOption.count();
  const ninthSubjectsCount = await prisma.subject.count({ where: { gradeId: ninthGrade.id } });

  console.log(`- THIRD_SECONDARY Questions After: ${thirdSecondaryQuestionsAfter} (Unchanged: ${thirdSecondaryQuestionsAfter === thirdSecondaryQuestionsBefore})`);
  console.log(`- NINTH Questions After: ${ninthQuestionsAfter} (Expected: 7917)`);
  console.log(`- Total Questions After: ${totalQuestionsAfter}`);
  console.log(`- Total Options After: ${totalOptionsAfter}`);
  console.log(`- NINTH Subjects Count: ${ninthSubjectsCount} (Expected: 6)`);

    return {
      success: true,
      mode,
      thirdSecondaryQuestionsBefore,
      thirdSecondaryQuestionsAfter,
      ninthQuestionsBefore,
      ninthQuestionsAfter,
      totalQuestionsBefore,
      totalQuestionsAfter,
      totalOptionsBefore,
      totalOptionsAfter,
      ninthSubjectsCount,
      subjectDistribution,
      mcqCount,
      trueFalseCount,
      correctMcqOptions,
      invalidRows,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = args.includes('--dry-run') || !isApply;

  let filePath = 'D:/three/import/grade9_question_bank_merged_verified_postgresql.sql';
  const fileArgIndex = args.indexOf('--file');
  if (fileArgIndex >= 0 && args[fileArgIndex + 1]) {
    filePath = args[fileArgIndex + 1];
  }

  const result = await runGrade9Import(filePath, isApply ? 'APPLY' : 'DRY_RUN');
  console.log('\nResult Summary:');
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nERROR:', err);
      process.exit(1);
    });
}
