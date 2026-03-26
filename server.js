import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// --- DATABASE SETUP ---
let db;

async function initializeDatabase() {
  try {
    db = await open({
      filename: './database.db',
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        content TEXT NOT NULL,
        isCompleted BOOLEAN NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database connected and table ensured.');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// --- EXPRESS APP SETUP ---
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- API ROUTES ---

// GET /api/todos - 获取所有待办事项
app.get('/api/todos', async (req, res) => {
  try {
    // For this simple app, we assume a single user (userId = 1)
    const todos = await db.all('SELECT * FROM todos ORDER BY createdAt DESC');
    res.json(todos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching todos' });
  }
});

// POST /api/todos - 创建一个新的待办事项
app.post('/api/todos', async (req, res) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ message: 'Content is required and must be a non-empty string.' });
  }

  try {
    const result = await db.run(
      'INSERT INTO todos (userId, content) VALUES (?, ?)',
      [1, content.trim()] // Hardcoded userId = 1
    );
    
    const newTodo = await db.get('SELECT * FROM todos WHERE id = ?', result.lastID);
    res.status(201).json(newTodo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating todo' });
  }
});

// PATCH /api/todos/:id - 更新待办事项状态
app.patch('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { isCompleted } = req.body;

  if (typeof isCompleted !== 'boolean') {
    return res.status(400).json({ message: 'isCompleted must be a boolean.' });
  }

  try {
    const todo = await db.get('SELECT * FROM todos WHERE id = ?', id);
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    const result = await db.run(
      'UPDATE todos SET isCompleted = ? WHERE id = ?',
      [isCompleted, id]
    );

    if (result.changes === 0) {
        return res.status(404).json({ message: 'Todo not found' });
    }

    const updatedTodo = await db.get('SELECT * FROM todos WHERE id = ?', id);
    res.json(updatedTodo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating todo' });
  }
});

// DELETE /api/todos/:id - 删除待办事项
app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.run('DELETE FROM todos WHERE id = ?', id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    res.status(204).send(); // No Content
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting todo' });
  }
});

// --- START SERVER ---
async function startServer() {
  await initializeDatabase();
  if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  }
}

startServer();

// Export app for testing
export { app, initializeDatabase };