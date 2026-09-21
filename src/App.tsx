import { useState, useEffect, useCallback } from 'react';
import { Todo, User } from './types';
import AddTodoForm from './components/AddTodoForm';
import TodoItem from './components/TodoItem';
import AuthForm from './components/AuthForm';
import {
  clearToken,
  createTodo,
  deleteTodo,
  fetchCurrentUser,
  fetchTodos,
  getStoredToken,
  login,
  register,
  storeToken,
  UnauthorizedError,
  updateTodo,
} from './api';

function App() {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!getStoredToken());

  const handleLogout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
    setTodos([]);
    setAuthReady(true);
  }, []);

  const handleAuthError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof UnauthorizedError) {
      handleLogout();
      setError('登录已过期，请重新登录');
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  }, [handleLogout]);

  const loadTodos = useCallback(async (currentToken: string) => {
    const data = await fetchTodos(currentToken);
    setTodos(data);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setTodos([]);
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { user: currentUser } = await fetchCurrentUser(token);
        if (cancelled) return;
        setUser(currentUser);
        await loadTodos(token);
        if (!cancelled) {
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof UnauthorizedError) {
            handleLogout();
            setError(null);
          } else {
            handleAuthError(err, 'Failed to fetch todos');
          }
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, loadTodos, handleAuthError, handleLogout]);

  const handleAuthSubmit = async (username: string, password: string, mode: 'login' | 'register') => {
    try {
      setError(null);
      const result = mode === 'login' ? await login(username, password) : await register(username, password);
      storeToken(result.token);
      setToken(result.token);
      setUser(result.user);
      setAuthReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const handleAddTodo = async (content: string) => {
    if (!token) return;
    try {
      const newTodo = await createTodo(token, content);
      setTodos(prevTodos => [newTodo, ...prevTodos]);
    } catch (err) {
      handleAuthError(err, 'Failed to add todo');
    }
  };

  const handleToggleTodo = async (id: number, isCompleted: boolean) => {
    if (!token) return;
    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id ? { ...todo, isCompleted: !isCompleted } : todo
      )
    );

    try {
      await updateTodo(token, id, !isCompleted);
    } catch (err) {
      handleAuthError(err, 'Failed to update todo');
      setTodos(prevTodos =>
        prevTodos.map(todo =>
          todo.id === id ? { ...todo, isCompleted } : todo
        )
      );
    }
  };

  const handleDeleteTodo = async (id: number) => {
    if (!token) return;
    const originalTodos = todos;
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));

    try {
      await deleteTodo(token, id);
    } catch (err) {
      handleAuthError(err, 'Failed to delete todo');
      setTodos(originalTodos);
    }
  };

  if (!authReady) {
    return (
      <div className="w-full max-w-2xl bg-card rounded-2xl p-8 shadow-lg mx-4">
        <p className="text-text-muted text-center">加载中...</p>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <div className="w-full max-w-2xl bg-card rounded-2xl p-8 shadow-lg mx-4">
        <header className="text-center mb-6">
          <h1 className="text-4xl font-bold text-text-primary">我的待办</h1>
        </header>
        <AuthForm onSubmitAuth={handleAuthSubmit} error={error} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl bg-card rounded-2xl p-8 shadow-lg mx-4">
      <header className="text-center mb-6">
        <h1 className="text-4xl font-bold text-text-primary">我的待办</h1>
        <div className="mt-3 flex items-center justify-center gap-3 text-text-muted">
          <span>{user.username}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-text-muted hover:text-danger transition-colors"
          >
            退出
          </button>
        </div>
      </header>

      <main>
        <AddTodoForm onAddTodo={handleAddTodo} />

        {error && <p className="text-danger text-center my-4">{error}</p>}

        <ul className="mt-8">
          {todos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={handleToggleTodo}
              onDelete={handleDeleteTodo}
            />
          ))}
        </ul>
      </main>
    </div>
  );
}

export default App;
