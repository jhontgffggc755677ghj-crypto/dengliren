export interface Todo {
  id: number;
  userId: number;
  content: string;
  isCompleted: boolean | number; // SQLite returns 0 or 1
  createdAt: string;
}