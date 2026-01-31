const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    // 학생 테이블 (device_id 추가)
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        device_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        parent_phone TEXT,
        memo TEXT
      )
    `);
    
    // 출석 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        device_id TEXT NOT NULL,
        student_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        UNIQUE(device_id, student_id, date)
      )
    `);
    
    // reason 컬럼 추가 (기존 테이블용)
    await client.query(`
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS reason TEXT
    `).catch(() => {});
    
    // 누가 기록 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS records (
        id SERIAL PRIMARY KEY,
        device_id TEXT NOT NULL,
        student_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    
    console.log('데이터베이스 테이블 준비 완료');
  } finally {
    client.release();
  }
}

function getPool() {
  return pool;
}

module.exports = { initDatabase, getPool };
