'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Moon, Sun, X } from 'lucide-react';
import { Button } from './primitives';
type ToastContextType = (message: string) => void;
const ToastContext = createContext<ToastContextType>(() => {});
export function UiProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  const toast = (value: string) => {
    clearTimeout(timeout.current);
    setMessage(value);
    timeout.current = setTimeout(() => setMessage(''), 6000);
  };
  return (
    <ToastContext value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="fixed right-4 bottom-4 z-50 max-w-[calc(100vw-2rem)]"
      >
        {message ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-raised px-5 py-3 text-sm text-ink shadow-xl">
            <span>{message}</span>
            <Button
              variant="ghost"
              className="px-2"
              onClick={() => setMessage('')}
              aria-label="알림 닫기"
            >
              <X size={16} />
            </Button>
          </div>
        ) : null}
      </div>
    </ToastContext>
  );
}
export const useToast = () => useContext(ToastContext);
export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(
    () => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'),
    [],
  );
  return (
    <Button
      variant="ghost"
      className="w-11 rounded-full px-0"
      aria-label={theme === 'dark' ? '라이트 테마로 변경' : '다크 테마로 변경'}
      onClick={() => {
        const next = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('cl-theme', next);
        setTheme(next);
      }}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
