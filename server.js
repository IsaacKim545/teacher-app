const express = require('express');
const path = require('path');
const { initDatabase, getDb, saveDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function toArray(result) {
  if (result.length === 0) return [];
  const columns = result[0].columns;
  return result[0].values.map(row => {
    const obj = {};
    columns.forEach((col, i) => obj[col] = row[i]);
    return obj;
  });
}

// 학생 목록
app.get('/api/students', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec('SELECT * FROM students ORDER BY number');
    res.json(toArray(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 학생 상세
app.get('/api/students/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(`SELECT * FROM students WHERE id = ${req.params.id}`);
    const students = toArray(result);
    if (students.length === 0) {
      return res.status(404).json({ error: '학생을 찾을 수 없습니다' });
    }
    res.json(students[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 학생 추가
app.post('/api/students', (req, res) => {
  try {
    const { number, name, phone, parent_phone, memo } = req.body;
    if (!number || !name) {
      return res.status(400).json({ error: '번호와 이름을 입력해주세요' });
    }
    const db = getDb();
    db.run('INSERT INTO students (number, name, phone, parent_phone, memo) VALUES (?, ?, ?, ?, ?)', 
      [number, name, phone || '', parent_phone || '', memo || '']);
    saveDatabase();
    const result = db.exec('SELECT last_insert_rowid() as id');
    res.json({ id: result[0].values[0][0], number, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 학생 수정
app.put('/api/students/:id', (req, res) => {
  try {
    const { number, name, phone, parent_phone, memo } = req.body;
    const db = getDb();
    db.run('UPDATE students SET number=?, name=?, phone=?, parent_phone=?, memo=? WHERE id=?',
      [number, name, phone || '', parent_phone || '', memo || '', req.params.id]);
    saveDatabase();
    res.json({ message: '수정 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 학생 삭제
app.delete('/api/students/:id', (req, res) => {
  try {
    const db = getDb();
    db.run('DELETE FROM students WHERE id = ?', [req.params.id]);
    db.run('DELETE FROM attendance WHERE student_id = ?', [req.params.id]);
    saveDatabase();
    res.json({ message: '삭제 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 출석 조회
app.get('/api/attendance/:date', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(`SELECT * FROM attendance WHERE date = '${req.params.date}'`);
    res.json(toArray(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 출석 저장
app.post('/api/attendance', (req, res) => {
  try {
    const { student_id, date, status } = req.body;
    const db = getDb();
    
    const existing = db.exec(`SELECT id FROM attendance WHERE student_id=${student_id} AND date='${date}'`);
    
    if (toArray(existing).length > 0) {
      db.run('UPDATE attendance SET status=? WHERE student_id=? AND date=?', [status, student_id, date]);
    } else {
      db.run('INSERT INTO attendance (student_id, date, status) VALUES (?, ?, ?)', [student_id, date, status]);
    }
    saveDatabase();
    res.json({ message: '저장 완료' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 출석 통계
app.get('/api/attendance/stats/:student_id', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(`
      SELECT status, COUNT(*) as count 
      FROM attendance 
      WHERE student_id = ${req.params.student_id}
      GROUP BY status
    `);
    res.json(toArray(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
