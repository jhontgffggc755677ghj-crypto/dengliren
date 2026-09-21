import { AuthResponse, Todo, User } from './types';

const TOKEN_KEY = 'token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // Ignore non-JSON error bodies.
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...init, headers });

  if (response.status === 401) {
    if (token) {
      throw new UnauthorizedError();
    }
    throw new Error(await parseErrorMessage(response, 'Unauthorized'));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Request failed'));
  }

  return response.json() as Promise<T>;
}

export function register(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchCurrentUser(token: string): Promise<{ user: User }> {
  return request<{ user: User }>('/api/auth/me', { method: 'GET' }, token);
}

export function fetchTodos(token: string): Promise<Todo[]> {
  return request<Todo[]>('/api/todos', { method: 'GET' }, token);
}

export function createTodo(token: string, content: string): Promise<Todo> {
  return request<Todo>('/api/todos', {
    method: 'POST',
    body: JSON.stringify({ content }),
  }, token);
}

export function updateTodo(token: string, id: number, isCompleted: boolean): Promise<Todo> {
  return request<Todo>(`/api/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isCompleted }),
  }, token);
}

export function deleteTodo(token: string, id: number): Promise<void> {
  return request<void>(`/api/todos/${id}`, { method: 'DELETE' }, token);
}
