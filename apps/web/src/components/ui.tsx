import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-ink hover:bg-primary-active',
  secondary: 'bg-canvas-soft text-ink hover:bg-[#dde1d9]',
  tertiary: 'bg-white text-ink border border-ink hover:bg-canvas-soft',
  danger: 'bg-negative text-white hover:bg-negative-deep',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-12 rounded-card px-6 py-3 text-base font-semibold disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card bg-white p-6 ${className}`}>{children}</div>;
}

export const inputClass =
  'w-full rounded-input border border-ink bg-white px-4 py-3 text-base text-ink';

export const compactInput =
  'w-full rounded-input border border-ink bg-white px-3 py-2 text-sm text-ink';

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string | undefined;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold">
        {label}
        <div className="mt-1 font-normal">{children}</div>
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-sm text-negative-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Dialog({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-card bg-white p-6"
      >
        <h2 className="mb-4 text-2xl font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
