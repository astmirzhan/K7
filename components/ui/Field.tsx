'use client';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const BOX =
  'w-full rounded-[10px] border-[3px] border-ink bg-mist px-4 text-[15px] text-ink placeholder:text-ink/45 ' +
  'focus:bg-white disabled:opacity-60 aria-[invalid=true]:border-danger';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = '',
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="k7-label text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink/70">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${BOX} h-12 ${className}`} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={`${BOX} min-h-12 py-3 leading-snug ${className}`} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${BOX} h-12 pr-10 ${className}`}>
      {children}
    </select>
  );
}

/** Row of exclusive chips bound to a value (age range, meet style, visibility). */
export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  testId,
  size = 'md',
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
  testId?: (v: T) => string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={testId?.(o.value)}
            onClick={() => onChange(o.value)}
            className={[
              'k7-label rounded-[8px] border-[3px] border-ink transition-colors',
              size === 'sm' ? 'h-8 px-2.5 text-[10px]' : 'h-9 px-3.5',
              active ? 'bg-ink text-yellow' : 'bg-white text-ink hover:bg-mist',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
