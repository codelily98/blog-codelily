import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from 'react';
import { twMerge } from 'tailwind-merge';
export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  const variants = {
    primary: 'bg-ink text-base hover:opacity-85',
    secondary: 'border border-line bg-surface text-ink hover:bg-raised',
    ghost: 'text-muted hover:bg-surface hover:text-ink',
    danger: 'border border-danger/50 text-danger hover:bg-danger/10',
  };
  return (
    <button
      type="button"
      className={twMerge(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
export function Field({
  label,
  id,
  hint,
  error,
  children,
}: {
  label: string;
  id: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
const control =
  'min-h-11 w-full rounded-lg border border-line bg-base px-3 py-2 text-sm text-ink placeholder:text-muted disabled:opacity-50';
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${control} ${className}`} {...props} />;
}
export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${control} min-h-28 ${className}`} {...props} />;
}
export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${control} ${className}`} {...props} />;
}
export function Spinner({ label = '불러오는 중' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-3 text-sm text-muted">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink motion-reduce:animate-none"
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description ? (
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
