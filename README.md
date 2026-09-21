# Todo App (Express + SQLite + Vite/React)

Username/password authentication with JWT. Todos belong to the signed-in user.

## Auth scheme

- **Identity:** `username` + `password` (not email).
- **Username:** 3–32 characters, letters, numbers, and underscores only.
- **Password:** 8–72 characters. Stored as a bcrypt hash; never returned by the API.
- **Auth:** `Authorization: Bearer <jwt>` on protected routes. No cookies.
- **JWT payload:** `{ userId, username }`. Default expiry is 7 days.

## Environment

Copy `.env.example` to `.env` and set a secret:

```bash
cp .env.example .env
```

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `JWT_SECRET` | Yes in production | insecure dev default | Signs and verifies JWTs |
| `JWT_EXPIRES_IN` | No | `7d` | Token lifetime |
| `PORT` | No | `3001` | API port |
| `DATABASE_PATH` | No | `./database.db` | SQLite file |

## Run locally

```bash
npm install
npm test
npm run dev
```

- API: `http://localhost:3001`
- UI (Vite proxy to the API): `http://localhost:5173`

The UI stores the JWT in `localStorage` as `token` and sends it on every `/api/todos` request.

## Error shape

All error responses are JSON:

```json
{ "message": "Human-readable error" }
```

## API contract

### `POST /api/auth/register`

Creates a user and returns a JWT.

Request:

```json
{ "username": "alice", "password": "password123" }
```

`201`:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "username": "alice" }
}
```

| Status | When |
| --- | --- |
| `400` | Invalid username or password |
| `409` | Username already taken |

### `POST /api/auth/login`

Request: same body as register.

`200`: same `{ token, user }` shape as register.

| Status | When |
| --- | --- |
| `400` | Missing username or password |
| `401` | Wrong username or password (`{ "message": "Invalid username or password." }`) |

### `GET /api/auth/me`

Requires `Authorization: Bearer <token>`.

`200`:

```json
{ "user": { "id": 1, "username": "alice" } }
```

`401`: `{ "message": "Unauthorized" }`

### Protected todos

Every `/api/todos` route requires a valid Bearer token and only sees that user's rows. Missing/invalid token → `401` `{ "message": "Unauthorized" }`. Another user's todo is treated as missing → `404`.

#### `GET /api/todos`

`200`: array of todos, newest first.

```json
[
  {
    "id": 2,
    "userId": 1,
    "content": "Buy milk",
    "isCompleted": 0,
    "createdAt": "2026-09-21 12:00:00"
  }
]
```

#### `POST /api/todos`

```json
{ "content": "Buy milk" }
```

`201`: the created todo. `400` if content is empty.

#### `PATCH /api/todos/:id`

```json
{ "isCompleted": true }
```

`200`: the updated todo. `400` if `isCompleted` is not a boolean. `404` if it is not the current user's todo.

#### `DELETE /api/todos/:id`

`204` empty body. `404` if it is not the current user's todo.
