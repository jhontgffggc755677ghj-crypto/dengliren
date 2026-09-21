import { FormEvent, useState } from 'react';

interface AuthFormProps {
  onSubmitAuth: (username: string, password: string, mode: 'login' | 'register') => Promise<void>;
  error: string | null;
}

function AuthForm({ onSubmitAuth, error }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    try {
      await onSubmitAuth(username.trim(), password, mode);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="用户名"
        className="w-full p-3.5 px-4 text-base bg-accent border-2 border-transparent rounded-lg text-text-primary outline-none transition-colors focus:border-danger placeholder:text-text-muted"
      />
      <input
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
        className="w-full p-3.5 px-4 text-base bg-accent border-2 border-transparent rounded-lg text-text-primary outline-none transition-colors focus:border-danger placeholder:text-text-muted"
      />
      {error && <p className="text-danger text-center">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="px-6 py-3.5 text-base font-semibold bg-danger text-white border-none rounded-lg cursor-pointer transition-all hover:bg-danger-hover active:transform active:scale-95 disabled:opacity-60"
      >
        {mode === 'login' ? '登录' : '注册'}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        className="text-text-muted hover:text-text-primary transition-colors"
      >
        {mode === 'login' ? '没有账号？注册' : '已有账号？登录'}
      </button>
    </form>
  );
}

export default AuthForm;
