import request from 'supertest';
import { app, initializeDatabase } from './server.js';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

let db;

beforeAll(async () => {
  // Use an in-memory database for tests
  db = await open({
    filename: ':memory:',
    driver: sqlite3.Database
  });
  await db.exec(`
    CREATE TABLE todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      content TEXT NOT NULL,
      isCompleted BOOLEAN NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // This is a simplified way to inject the test db.
  // In a real app, you'd use dependency injection.
  // For this test, we'll clear the table before each test.
  await initializeDatabase(); // Connects to the file db, but we'll clear it.
});

beforeEach(async () => {
  // Clean the database before each test
  const fileDb = await open({ filename: './database.db', driver: sqlite3.Database });
  await fileDb.exec('DELETE FROM todos');
  await fileDb.close();
});

describe('Todo API', () => {
  it('should create a new todo', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ content: 'Test todo' });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.content).toBe('Test todo');
    expect(res.body.isCompleted).toBe(0); // SQLite uses 0 for false
  });

  it('should not create a todo with empty content', async () => {
    const res = await request(app)
      .post('/api/todos')
      .send({ content: ' ' });
    expect(res.statusCode).toEqual(400);
  });

  it('should fetch all todos', async () => {
    await request(app).post('/api/todos').send({ content: 'First' });
    await request(app).post('/api/todos').send({ content: 'Second' });

    const res = await request(app).get('/api/todos');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].content).toBe('Second'); // Ordered by DESC
  });

  it('should update a todo status', async () => {
    const postRes = await request(app)
      .post('/api/todos')
      .send({ content: 'To be updated' });
    const todoId = postRes.body.id;

    const patchRes = await request(app)
      .patch(`/api/todos/${todoId}`)
      .send({ isCompleted: true });
      
    expect(patchRes.statusCode).toEqual(200);
    expect(patchRes.body.isCompleted).toBe(1); // SQLite uses 1 for true
  });

  it('should return 404 when updating a non-existent todo', async () => {
    const res = await request(app)
      .patch('/api/todos/999')
      .send({ isCompleted: true });
    expect(res.statusCode).toEqual(404);
  });

  it('should delete a todo', async () => {
    const postRes = await request(app)
      .post('/api/todos')
      .send({ content: 'To be deleted' });
    const todoId = postRes.body.id;

    const deleteRes = await request(app).delete(`/api/todos/${todoId}`);
    expect(deleteRes.statusCode).toEqual(204);

    const getRes = await request(app).get('/api/todos');
    expect(getRes.body.length).toBe(0);
  });

  it('should return 404 when deleting a non-existent todo', async () => {
    const res = await request(app).delete('/api/todos/999');
    expect(res.statusCode).toEqual(404);
  });
});