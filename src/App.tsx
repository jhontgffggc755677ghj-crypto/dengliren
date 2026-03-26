import { useState, useEffect, useCallback } from 'react';
import { Todo } from './types';
import AddTodoForm from './components/AddTodoForm';
import TodoItem from './components/TodoItem';

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/todos');
      if (!response.ok) {
        throw new Error('Failed to fetch todos');
      }
      const data: Todo[] = await response.json();
      setTodos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleAddTodo = async (content: string) => {
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        throw new Error('Failed to add todo');
      }
      const newTodo = await response.json();
      setTodos(prevTodos => [newTodo, ...prevTodos]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add todo');
    }
  };

  const handleToggleTodo = async (id: number, isCompleted: boolean) => {
    // Optimistic update
    setTodos(prevTodos =>
      prevTodos.map(todo =>
        todo.id === id ? { ...todo, isCompleted: !isCompleted } : todo
      )
    );

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !isCompleted }),
      });
      if (!response.ok) {
        throw new Error('Failed to update todo');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update todo');
      // Revert on error
      setTodos(prevTodos =>
        prevTodos.map(todo =>
          todo.id === id ? { ...todo, isCompleted } : todo
        )
      );
    }
  };

  const handleDeleteTodo = async (id: number) => {
     // Optimistic update
    const originalTodos = todos;
    setTodos(prevTodos => prevTodos.filter(todo => todo.id !== id));

    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete todo');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete todo');
      // Revert on error
      setTodos(originalTodos);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-card rounded-2xl p-8 shadow-lg mx-4">
      <header className="text-center mb-6">
        <h1 className="text-4xl font-bold text-text-primary">我的待办</h1>
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