import request from 'supertest';
import { app, initializeDatabase, closeDatabase, getDb } from './server.js';

const PASSWORD = 'password123';

async function registerUser(username, password = PASSWORD) {
  return request(app).post('/api/auth/register').send({ username, password });
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

beforeEach(async () => {
  const db = getDb();
  await db.exec('DELETE FROM todos');
  await db.exec('DELETE FROM users');
});

afterAll(async () => {
  await closeDatabase();
});

describe('Auth API', () => {
  it('should register a user and return a token', async () => {
    const res = await registerUser('alice');

    expect(res.statusCode).toEqual(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: expect.any(Number), username: 'alice' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password');
  });

  it('should store a hashed password, not plaintext', async () => {
    await registerUser('alice');
    const user = await getDb().get('SELECT passwordHash FROM users WHERE username = ?', 'alice');

    expect(user.passwordHash).toEqual(expect.any(String));
    expect(user.passwordHash).not.toBe(PASSWORD);
    expect(user.passwordHash.startsWith('$2')).toBe(true);
  });

  it('should reject duplicate usernames', async () => {
    await registerUser('alice');
    const res = await registerUser('alice');

    expect(res.statusCode).toEqual(409);
    expect(res.body).toEqual({ message: 'Username is already taken.' });
  });

  it('should reject invalid usernames and short passwords', async () => {
    const badUsername = await registerUser('ab', PASSWORD);
    expect(badUsername.statusCode).toEqual(400);

    const badPassword = await registerUser('alice', 'short');
    expect(badPassword.statusCode).toEqual(400);
  });

  it('should log in with valid credentials', async () => {
    await registerUser('alice');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: PASSWORD });

    expect(res.statusCode).toEqual(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: expect.any(Number), username: 'alice' });
  });

  it('should reject wrong passwords and unknown users', async () => {
    await registerUser('alice');

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'wrong-password' });
    expect(wrongPassword.statusCode).toEqual(401);
    expect(wrongPassword.body).toEqual({ message: 'Invalid username or password.' });

    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: PASSWORD });
    expect(unknownUser.statusCode).toEqual(401);
    expect(unknownUser.body).toEqual({ message: 'Invalid username or password.' });
  });

  it('should reject login without username or password', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toEqual(400);
  });

  it('should return the current user for a valid token', async () => {
    const registered = await registerUser('alice');
    const res = await request(app)
      .get('/api/auth/me')
      .set(bearer(registered.body.token));

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ user: { id: registered.body.user.id, username: 'alice' } });
  });
});

describe('Todo API auth', () => {
  it('should return 401 for todo routes without a token', async () => {
    const getRes = await request(app).get('/api/todos');
    expect(getRes.statusCode).toEqual(401);
    expect(getRes.body).toEqual({ message: 'Unauthorized' });

    const postRes = await request(app).post('/api/todos').send({ content: 'Nope' });
    expect(postRes.statusCode).toEqual(401);

    const patchRes = await request(app).patch('/api/todos/1').send({ isCompleted: true });
    expect(patchRes.statusCode).toEqual(401);

    const deleteRes = await request(app).delete('/api/todos/1');
    expect(deleteRes.statusCode).toEqual(401);
  });

  it('should return 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/todos')
      .set(bearer('not-a-real-token'));
    expect(res.statusCode).toEqual(401);
    expect(res.body).toEqual({ message: 'Unauthorized' });
  });
});

describe('Todo API', () => {
  let token;

  beforeEach(async () => {
    const res = await registerUser('alice');
    token = res.body.token;
  });

  it('should create a new todo', async () => {
    const res = await request(app)
      .post('/api/todos')
      .set(bearer(token))
      .send({ content: 'Test todo' });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.content).toBe('Test todo');
    expect(res.body.isCompleted).toBe(0);
    expect(res.body.userId).toBeGreaterThan(0);
  });

  it('should not create a todo with empty content', async () => {
    const res = await request(app)
      .post('/api/todos')
      .set(bearer(token))
      .send({ content: ' ' });
    expect(res.statusCode).toEqual(400);
  });

  it('should fetch all todos', async () => {
    await request(app).post('/api/todos').set(bearer(token)).send({ content: 'First' });
    await request(app).post('/api/todos').set(bearer(token)).send({ content: 'Second' });

    const res = await request(app).get('/api/todos').set(bearer(token));
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].content).toBe('Second');
  });

  it('should update a todo status', async () => {
    const postRes = await request(app)
      .post('/api/todos')
      .set(bearer(token))
      .send({ content: 'To be updated' });
    const todoId = postRes.body.id;

    const patchRes = await request(app)
      .patch(`/api/todos/${todoId}`)
      .set(bearer(token))
      .send({ isCompleted: true });

    expect(patchRes.statusCode).toEqual(200);
    expect(patchRes.body.isCompleted).toBe(1);
  });

  it('should return 404 when updating a non-existent todo', async () => {
    const res = await request(app)
      .patch('/api/todos/999')
      .set(bearer(token))
      .send({ isCompleted: true });
    expect(res.statusCode).toEqual(404);
  });

  it('should delete a todo', async () => {
    const postRes = await request(app)
      .post('/api/todos')
      .set(bearer(token))
      .send({ content: 'To be deleted' });
    const todoId = postRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/todos/${todoId}`)
      .set(bearer(token));
    expect(deleteRes.statusCode).toEqual(204);

    const getRes = await request(app).get('/api/todos').set(bearer(token));
    expect(getRes.body.length).toBe(0);
  });

  it('should return 404 when deleting a non-existent todo', async () => {
    const res = await request(app).delete('/api/todos/999').set(bearer(token));
    expect(res.statusCode).toEqual(404);
  });
});

describe('Todo API user isolation', () => {
  it('should only list, update, and delete the current user\'s todos', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    const aliceTodo = await request(app)
      .post('/api/todos')
      .set(bearer(alice.body.token))
      .send({ content: 'Alice task' });
    await request(app)
      .post('/api/todos')
      .set(bearer(bob.body.token))
      .send({ content: 'Bob task' });

    const aliceList = await request(app)
      .get('/api/todos')
      .set(bearer(alice.body.token));
    expect(aliceList.statusCode).toEqual(200);
    expect(aliceList.body.map((todo) => todo.content)).toEqual(['Alice task']);

    const bobList = await request(app)
      .get('/api/todos')
      .set(bearer(bob.body.token));
    expect(bobList.body.map((todo) => todo.content)).toEqual(['Bob task']);

    const patchRes = await request(app)
      .patch(`/api/todos/${aliceTodo.body.id}`)
      .set(bearer(bob.body.token))
      .send({ isCompleted: true });
    expect(patchRes.statusCode).toEqual(404);

    const deleteRes = await request(app)
      .delete(`/api/todos/${aliceTodo.body.id}`)
      .set(bearer(bob.body.token));
    expect(deleteRes.statusCode).toEqual(404);

    const stillThere = await request(app)
      .get('/api/todos')
      .set(bearer(alice.body.token));
    expect(stillThere.body).toHaveLength(1);
    expect(stillThere.body[0].isCompleted).toBe(0);
  });
});
