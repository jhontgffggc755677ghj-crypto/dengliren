import { useState, FormEvent } from 'react';

interface AddTodoFormProps {
  onAddTodo: (content: string) => Promise<void>;
}

function AddTodoForm({ onAddTodo }: AddTodoFormProps) {
  const [content, setContent] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await onAddTodo(content);
    setContent('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="添加新的待办事项..."
        className="flex-grow p-3.5 px-4 text-base bg-accent border-2 border-transparent rounded-lg text-text-primary outline-none transition-colors focus:border-danger placeholder:text-text-muted"
      />
      <button
        type="submit"
        className="px-6 py-3.5 text-base font-semibold bg-danger text-white border-none rounded-lg cursor-pointer transition-all hover:bg-danger-hover active:transform active:scale-95"
      >
        添加
      </button>
    </form>
  );
}

export default AddTodoForm;