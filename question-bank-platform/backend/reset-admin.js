const argon2 = require('argon2');
const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const hash = await argon2.hash('admin123', { type: argon2.argon2id });
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  
  const res = await client.query(`UPDATE "User" SET "passwordHash" = $1 WHERE email = 'admin@admin.com'`, [hash]);
  
  if (res.rowCount === 0) {
    console.log("Admin not found. Creating...");
    await client.query(`
      INSERT INTO "User" (
        "id", "name", "username", "email", "phone", "passwordHash", "role", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), 'Admin', 'admin_01', 'admin@admin.com', '0500000000', $1, 'SUPER_ADMIN', true, NOW(), NOW()
      )
    `, [hash]);
  }
  
  console.log('Password reset successfully!');
  await client.end();
}

main().catch(console.error);
