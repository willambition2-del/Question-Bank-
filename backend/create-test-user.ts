import { PrismaClient } from './src/generated/prisma/client';
import { UserRole } from './src/generated/prisma/enums';
import * as argon2 from 'argon2';

process.env.DATABASE_URL = 'postgresql://question_bank_user:adam778190689@localhost:5432/question_bank?schema=public';
// @ts-ignore
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });

async function main() {
  const email = 'testuser@example.com';
  const password = 'Password123!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      isActive: true,
      role: UserRole.STUDENT
    },
    create: {
      name: 'Test Student',
      username: 'teststudent_01',
      email: email,
      phone: '0500000000',
      passwordHash: passwordHash,
      role: UserRole.STUDENT,
      isActive: true,
    }
  });

  console.log(`User created successfully!
================================
Email: ${email}
Password: ${password}
================================`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
