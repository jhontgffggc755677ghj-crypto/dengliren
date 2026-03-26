import { Todo } from '../types';

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number, isCompleted: boolean) => void;
  onDelete: (id: number) => void;
}

function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  const isCompleted = !!todo.isCompleted;

  return (
    <li className={`flex items-center p-4 border-b border-border last:border-b-0 transition-colors ${isCompleted ? 'opacity-60' : ''}`}>
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={() => onToggle(todo.id, isCompleted)}
          className="hidden"
        />
        <div
          className={`w-6 h-6 border-2 rounded-full mr-4 flex-shrink-0 flex items-center justify-center transition-all ${
            isCompleted ? 'bg-danger border-danger' : 'border-text-muted'
          }`}
        >
          {isCompleted && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </label>

      <span className={`flex-grow text-text-primary transition-all ${isCompleted ? 'line-through text-text-muted' : ''}`}>
        {todo.content}
      </span>

      <button
        onClick={() => onDelete(todo.id)}
        className="ml-4 p-1 text-text-muted hover:text-danger transition-colors"
        aria-label={`删除 "${todo.content}"`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.134H8.09c-1.18 0-2.09.954-2.09 2.134v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </button>
    </li>
  );
}

export default TodoItem;