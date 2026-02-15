const express = require('express');
const path = require('path');
const { initDatabase, getPool } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ 학생 API ============

// 학생 목록 (기기별)
app.get('/api/students', async (req, res) => {
  try {
    const { device_id } = req.query;
    if (!device_id) return res.status(400).json({ error: 'device_id 필요' });
    
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM students WHERE device_id = $1 ORDER BY number',
      [device_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 학생 상세
app.get('/api/students/:id', async (req, res) => {
  try {
    const { device_id } = req.query;
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM students WHERE id = $1 AND device_id = $2',
      [req.params.id, device_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '학생을 찾을 수 없습니다' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 학생 추가
app.post('/api/students', async (req, res) => {
  try {
    const { device_id, number, name, phone, parent_phone, memo } = req.body;
    if (!device_id || !number || !name) {
      return res.status(400).json({ error: '필수 항목을 입력해주세요' });
    }
    
    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO students (device_id, number, name, phone, parent_phone, memo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [device_id, number, name, phone || '', parent_phone || '', memo || '']
    );
    res.json({ id: result.rows[0].id, number, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 학생 수정
app.put('/api/students/:id', async (req, res) => {
  try {
    const { device_id, number, name, phone, parent_phone, memo } = req.body;
    const pool = getPool();
    await pool.query(
      'UPDATE students SET number=$1, name=$2, phone=$3, parent_phone=$4, memo=$5 WHERE id=$6 AND device_id=$7',
      [number, name, phone || '', parent_phone || '', memo || '', req.params.id, device_id]
    );
    res.json({ message: '수정 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 학생 삭제
app.delete('/api/students/:id', async (req, res) => {
  try {
    const { device_id } = req.query;
    const pool = getPool();
    await pool.query('DELETE FROM students WHERE id = $1 AND device_id = $2', [req.params.id, device_id]);
    await pool.query('DELETE FROM attendance WHERE student_id = $1 AND device_id = $2', [req.params.id, device_id]);
    await pool.query('DELETE FROM records WHERE student_id = $1 AND device_id = $2', [req.params.id, device_id]);
    res.json({ message: '삭제 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 출석 API ============

// 출석 조회
app.get('/api/attendance/:date', async (req, res) => {
  try {
    const { device_id } = req.query;
    const pool = getPool();
    const result = await pool.query(
      'SELECT student_id, status, reason FROM attendance WHERE date = $1 AND device_id = $2',
      [req.params.date, device_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 출석 저장
app.post('/api/attendance', async (req, res) => {
  try {
    const { device_id, student_id, date, status, reason } = req.body;
    const pool = getPool();
    
    // UPSERT
    await pool.query(`
      INSERT INTO attendance (device_id, student_id, date, status, reason)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (device_id, student_id, date)
      DO UPDATE SET status = $4, reason = $5
    `, [device_id, student_id, date, status, reason || '']);
    
    res.json({ message: '저장 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 출석 통계
app.get('/api/attendance/stats/:student_id', async (req, res) => {
  try {
    const { device_id } = req.query;
    const pool = getPool();
    const result = await pool.query(
      'SELECT status, COUNT(*) as count FROM attendance WHERE student_id = $1 AND device_id = $2 GROUP BY status',
      [req.params.student_id, device_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 누가 기록 API ============

// 기록 조회
app.get('/api/records/:student_id', async (req, res) => {
  try {
    const { device_id } = req.query;
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM records WHERE student_id = $1 AND device_id = $2 ORDER BY created_at DESC',
      [req.params.student_id, device_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 기록 추가
app.post('/api/records', async (req, res) => {
  try {
    const { device_id, student_id, type, content } = req.body;
    
    if (!device_id || !student_id || !type || !content) {
      return res.status(400).json({ error: '필수 항목을 입력해주세요' });
    }
    
    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const created_at = koreaTime.toISOString().replace('T', ' ').substring(0, 19);
    
    const pool = getPool();
    const result = await pool.query(
      'INSERT INTO records (device_id, student_id, type, content, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [device_id, student_id, type, content, created_at]
    );
    
    res.json({ id: result.rows[0].id, student_id, type, content, created_at });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 기록 삭제
app.delete('/api/records/:id', async (req, res) => {
  try {
    const { device_id } = req.query;
    const pool = getPool();
    await pool.query('DELETE FROM records WHERE id = $1 AND device_id = $2', [req.params.id, device_id]);
    res.json({ message: '삭제 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 기록 수정
app.put('/api/records/:id', async (req, res) => {
  try {
    const { device_id, type, content } = req.body;
    const pool = getPool();
    await pool.query(
      'UPDATE records SET type=$1, content=$2 WHERE id=$3 AND device_id=$4',
      [type, content, req.params.id, device_id]
    );
    res.json({ message: '수정 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 일괄 출석 API ============

app.post('/api/attendance/bulk', async (req, res) => {
  try {
    const { device_id, date, student_ids, status } = req.body;
    const pool = getPool();
    for (const student_id of student_ids) {
      await pool.query(`
        INSERT INTO attendance (device_id, student_id, date, status, reason)
        VALUES ($1, $2, $3, $4, '')
        ON CONFLICT (device_id, student_id, date)
        DO UPDATE SET status = $4, reason = ''
      `, [device_id, student_id, date, status]);
    }
    res.json({ message: '일괄 저장 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 상담 API ============

// 상담 전체 조회
app.get('/api/counseling', async (req, res) => {
  try {
    const { device_id, pending } = req.query;
    if (!device_id) return res.status(400).json({ error: 'device_id 필요' });
    const pool = getPool();
    let query = `
      SELECT c.*, s.name as student_name, s.number as student_number
      FROM counseling c
      LEFT JOIN students s ON c.student_id = s.id
      WHERE c.device_id = $1
    `;
    if (pending === 'true') {
      query += ` AND c.follow_up IS NOT NULL AND c.follow_up != '' AND c.is_completed = false`;
    }
    query += ' ORDER BY c.date DESC, c.id DESC';
    const result = await pool.query(query, [device_id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 학생별 상담 조회
app.get('/api/counseling/:student_id', async (req, res) => {
  try {
    const { device_id } = req.query;
    const pool = getPool();
    const result = await pool.query(`
      SELECT c.*, s.name as student_name, s.number as student_number
      FROM counseling c
      LEFT JOIN students s ON c.student_id = s.id
      WHERE c.student_id = $1 AND c.device_id = $2
      ORDER BY c.date DESC, c.id DESC
    `, [req.params.student_id, device_id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 상담 추가
app.post('/api/counseling', async (req, res) => {
  try {
    const { device_id, student_id, date, counsel_type, topic, content, result, follow_up, next_date } = req.body;
    if (!device_id || !student_id || !counsel_type || !topic || !content) {
      return res.status(400).json({ error: '필수 항목을 입력해주세요' });
    }
    const pool = getPool();
    const dbResult = await pool.query(
      `INSERT INTO counseling (device_id, student_id, date, counsel_type, topic, content, result, follow_up, next_date, is_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false) RETURNING id`,
      [device_id, student_id, date, counsel_type, topic, content, result || '', follow_up || '', next_date || null]
    );
    res.json({ id: dbResult.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 상담 수정
app.put('/api/counseling/:id', async (req, res) => {
  try {
    const { device_id, student_id, date, counsel_type, topic, content, result, follow_up, next_date } = req.body;
    const pool = getPool();
    await pool.query(
      `UPDATE counseling SET student_id=$1, date=$2, counsel_type=$3, topic=$4, content=$5, result=$6, follow_up=$7, next_date=$8
       WHERE id=$9 AND device_id=$10`,
      [student_id, date, counsel_type, topic, content, result || '', follow_up || '', next_date || null, req.params.id, device_id]
    );
    res.json({ message: '수정 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 후속조치 완료
app.patch('/api/counseling/:id/complete', async (req, res) => {
  try {
    const { device_id } = req.body;
    const pool = getPool();
    await pool.query(
      'UPDATE counseling SET is_completed = true WHERE id = $1 AND device_id = $2',
      [req.params.id, device_id]
    );
    res.json({ message: '완료 처리' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 상담 삭제
app.delete('/api/counseling/:id', async (req, res) => {
  try {
    const { device_id } = req.query;
    const pool = getPool();
    await pool.query('DELETE FROM counseling WHERE id = $1 AND device_id = $2', [req.params.id, device_id]);
    res.json({ message: '삭제 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 대시보드 API ============

app.get('/api/dashboard', async (req, res) => {
  try {
    const { device_id } = req.query;
    if (!device_id) return res.status(400).json({ error: 'device_id 필요' });
    const pool = getPool();
    const students = await pool.query('SELECT COUNT(*) as count FROM students WHERE device_id = $1', [device_id]);
    const pending = await pool.query(
      `SELECT COUNT(*) as count FROM counseling WHERE device_id = $1 AND follow_up IS NOT NULL AND follow_up != '' AND is_completed = false`,
      [device_id]
    );
    res.json({
      student_count: parseInt(students.rows[0].count),
      pending_counseling: parseInt(pending.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 서버 시작
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  서버가 실행되었습니다');
    console.log(`  포트: ${PORT}`);
    console.log('========================================');
  });
}

start();
