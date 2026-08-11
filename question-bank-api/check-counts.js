const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    const tables = [
      ['Questions', 'Question'],
      ['Options', 'QuestionOption'],
      ['QuestionSourceReference', 'QuestionSourceReference'],
      ['Subjects', 'Subject'],
      ['Units', 'Unit'],
      ['Lessons', 'Lesson'],
      ['Sources', 'Source'],
      ['ReadingPassages', 'ReadingPassage'],
      ['ImportJobs', 'QuestionImportJob']
    ];
    
    const results = {};
    for (const [name, table] of tables) {
      const res = await client.query(`SELECT count(*) FROM "${table}"`);
      results[name] = parseInt(res.rows[0].count, 10);
    }
    
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

main();
