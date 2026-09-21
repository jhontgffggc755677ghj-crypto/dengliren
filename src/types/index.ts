export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
}

export interface Todo {
  id: number;
  userId: number;
  content: string;
  isCompleted: boolean | number; // SQLite returns 0 or 1
  createdAt: string;
}
