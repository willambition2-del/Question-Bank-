import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { CompanionType, UserRole } from '../src/generated/prisma/enums';
import { seedContent } from './seed-content';
import { seedGamification } from './seed-gamification';

const SUBJECTS = [
  {
    name: 'اللغة الإنجليزية',
    slug: 'english',
    iconKey: 'english',
    colorHex: '#315BE8',
  },
  { name: 'الأحياء', slug: 'biology', iconKey: 'biology', colorHex: '#2E9D62' },
  {
    name: 'اللغة العربية',
    slug: 'arabic',
    iconKey: 'arabic',
    colorHex: '#A663CC',
  },
  {
    name: 'الكيمياء',
    slug: 'chemistry',
    iconKey: 'chemistry',
    colorHex: '#E58B2B',
  },
  {
    name: 'الفيزياء',
    slug: 'physics',
    iconKey: 'physics',
    colorHex: '#315BE8',
  },
  {
    name: 'التربية الإسلامية',
    slug: 'islamic-studies',
    iconKey: 'islamic',
    colorHex: '#1C8C80',
  },
  {
    name: 'القرآن الكريم',
    slug: 'quran',
    iconKey: 'quran',
    colorHex: '#B88719',
  },
] as const;

async function seedEducation(prisma: PrismaClient): Promise<void> {
  const grade = await prisma.grade.upsert({
    where: { slug: 'grade-12' },
    update: { name: 'الثالث الثانوي', isActive: true, deletedAt: null },
    create: {
      name: 'الثالث الثانوي',
      slug: 'grade-12',
      description: 'الصف الثالث الثانوي',
      sortOrder: 1,
    },
  });
  const curriculum = await prisma.curriculum.upsert({
    where: { slug: 'yemeni-curriculum' },
    update: {
      name: 'المنهج اليمني',
      countryCode: 'YE',
      isActive: true,
      deletedAt: null,
    },
    create: {
      name: 'المنهج اليمني',
      slug: 'yemeni-curriculum',
      countryCode: 'YE',
      description: 'المنهج الرسمي للجمهورية اليمنية',
    },
  });
  await prisma.curriculumGrade.upsert({
    where: {
      curriculumId_gradeId: {
        curriculumId: curriculum.id,
        gradeId: grade.id,
      },
    },
    update: { isActive: true },
    create: { curriculumId: curriculum.id, gradeId: grade.id },
  });

  for (const [index, definition] of SUBJECTS.entries()) {
    const subject = await prisma.subject.upsert({
      where: {
        curriculumId_gradeId_slug: {
          curriculumId: curriculum.id,
          gradeId: grade.id,
          slug: definition.slug,
        },
      },
      update: {
        name: definition.name,
        iconKey: definition.iconKey,
        colorHex: definition.colorHex,
        sortOrder: index + 1,
        isActive: true,
        isPublished: true,
        deletedAt: null,
      },
      create: {
        curriculumId: curriculum.id,
        gradeId: grade.id,
        name: definition.name,
        slug: definition.slug,
        iconKey: definition.iconKey,
        colorHex: definition.colorHex,
        sortOrder: index + 1,
        isPublished: true,
      },
    });
    const unit = await prisma.unit.upsert({
      where: {
        subjectId_slug: { subjectId: subject.id, slug: 'introduction' },
      },
      update: {
        name: `مدخل إلى ${definition.name}`,
        isActive: true,
        isPublished: true,
        deletedAt: null,
      },
      create: {
        subjectId: subject.id,
        name: `مدخل إلى ${definition.name}`,
        slug: 'introduction',
        sortOrder: 1,
        isPublished: true,
      },
    });
    await prisma.lesson.upsert({
      where: { unitId_slug: { unitId: unit.id, slug: 'first-lesson' } },
      update: {
        subjectId: subject.id,
        name: 'الدرس الأول',
        isActive: true,
        isPublished: true,
        deletedAt: null,
      },
      create: {
        subjectId: subject.id,
        unitId: unit.id,
        name: 'الدرس الأول',
        slug: 'first-lesson',
        summary: 'درس تمهيدي تجريبي قابل للاستبدال بالمحتوى الرسمي.',
        sortOrder: 1,
        isPublished: true,
      },
    });
  }

  console.log('Education seed completed successfully.');
}

async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const name = process.env.ADMIN_NAME?.trim();
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const phone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!name || !username || !phone || !password) {
    console.log(
      'Admin seed skipped: ADMIN_NAME, ADMIN_USERNAME, ADMIN_PHONE, and ADMIN_PASSWORD are required.',
    );
    return;
  }
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { username },
    update: {
      name,
      phone,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      deletedAt: null,
    },
    create: {
      name,
      username,
      phone,
      passwordHash,
      role: UserRole.ADMIN,
      companion: CompanionType.MALE,
      isActive: true,
    },
  });
  console.log('Admin seed completed successfully.');
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('Seed skipped: DATABASE_URL is required.');
    return;
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    await seedEducation(prisma);
    await seedContent(prisma);
    await seedGamification(prisma);
    await seedAdmin(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
