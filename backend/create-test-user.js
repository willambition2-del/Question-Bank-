const argon2 = require('argon2');
const { Client } = require('pg');

async function main() {
  const hash = await argon2.hash('Password123!', { type: argon2.argon2id });
  const client = new Client({
    connectionString: 'postgresql://question_bank_user:adam778190689@localhost:5432/question_bank?schema=public'
  });
  await client.connect();
  
  // Check if exists
  const existing = await client.query(`SELECT id FROM "User" WHERE email = 'testuser@example.com'`);
  if (existing.rows.length > 0) {
    await client.query(`UPDATE "User" SET "passwordHash" = $1 WHERE email = 'testuser@example.com'`, [hash]);
  } else {
    await client.query(`
      INSERT INTO "User" (
        "id", "name", "username", "email", "phone", "passwordHash", "role", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), 'Test Student', 'teststudent_01', 'testuser@example.com', '0500000000', $1, 'STUDENT', true, NOW(), NOW()
      )
    `, [hash]);
  }
  
  console.log('User created successfully!');
  console.log('Email: testuser@example.com');
  console.log('Password: Password123!');
  await client.end();
}

main().catch(console.error);
