import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3001;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

let db;

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  return 'dev-insecure-secret-change-me';
}

function getBcryptRounds() {
  if (process.env.NODE_ENV === 'test') {
    return 4;
  }
  return 10;
}

function signToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function publicUser(user) {
  return { id: user.id, username: user.username };
}

function authResponse(user) {
  return {
    token: signToken(user),
    user: publicUser(user),
  };
}

export async function initializeDatabase(filename) {
  const dbPath = filename ?? process.env.DATABASE_PATH ?? './database.db';

  if (db) {
    await db.close();
    db = undefined;
  }

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  await db.exec('PRAGMA foreign_keys = ON;');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      content TEXT NOT NULL,
      isCompleted BOOLEAN NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);

  return db;
}

export function getDb() {
  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = undefined;
  }
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const userId = Number(payload.userId);
    if (!Number.isInteger(userId) || userId < 1 || typeof payload.username !== 'string') {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    req.user = { id: userId, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

function validateRegisterInput(username, password) {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
    return 'Username must be 3-32 characters and contain only letters, numbers, and underscores.';
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

const app = express();

app.use(cors());
app.use(express.json());

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body ?? {};
  const validationError = validateRegisterInput(username, password);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE username = ?', username);
    if (existing) {
      return res.status(409).json({ message: 'Username is already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, getBcryptRounds());
    const result = await db.run(
      'INSERT INTO users (username, passwordHash) VALUES (?, ?)',
      [username, passwordHash]
    );
    const user = await db.get('SELECT id, username FROM users WHERE id = ?', result.lastID);
    res.status(201).json(authResponse(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || username.trim() === '' || typeof password !== 'string' || password === '') {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    const user = await db.get('SELECT id, username, passwordHash FROM users WHERE username = ?', username);
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    res.json(authResponse(user));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await db.get('SELECT id, username FROM users WHERE id = ?', req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching current user' });
  }
});

app.use('/api/todos', requireAuth);

app.get('/api/todos', async (req, res) => {
  try {
    const todos = await db.all(
      'SELECT * FROM todos WHERE userId = ? ORDER BY createdAt DESC',
      req.user.id
    );
    res.json(todos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching todos' });
  }
});

app.post('/api/todos', async (req, res) => {
  const { content } = req.body ?? {};

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ message: 'Content is required and must be a non-empty string.' });
  }

  try {
    const result = await db.run(
      'INSERT INTO todos (userId, content) VALUES (?, ?)',
      [req.user.id, content.trim()]
    );

    const newTodo = await db.get('SELECT * FROM todos WHERE id = ?', result.lastID);
    res.status(201).json(newTodo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating todo' });
  }
});

app.patch('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { isCompleted } = req.body ?? {};

  if (typeof isCompleted !== 'boolean') {
    return res.status(400).json({ message: 'isCompleted must be a boolean.' });
  }

  try {
    const todo = await db.get(
      'SELECT * FROM todos WHERE id = ? AND userId = ?',
      [id, req.user.id]
    );
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    await db.run(
      'UPDATE todos SET isCompleted = ? WHERE id = ? AND userId = ?',
      [isCompleted, id, req.user.id]
    );

    const updatedTodo = await db.get(
      'SELECT * FROM todos WHERE id = ? AND userId = ?',
      [id, req.user.id]
    );
    res.json(updatedTodo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating todo' });
  }
});

app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.run(
      'DELETE FROM todos WHERE id = ? AND userId = ?',
      [id, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting todo' });
  }
});

async function startServer() {
  await initializeDatabase();
  getJwtSecret();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { app };
