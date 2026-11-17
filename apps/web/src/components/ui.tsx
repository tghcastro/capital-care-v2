import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger';
const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-button hover:bg-primary-deep uppercase',
  secondary: 'bg-canvas-soft text-primary hover:bg-mint-100 uppercase',
  outline:
    'border border-hairline-strong bg-white text-primary hover:bg-mint-50 !rounded-card !px-4 !py-2',
  danger: 'bg-error text-white hover:bg-[#b61f1f] uppercase',
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
      className={`rounded-control px-4 py-3 text-sm font-bold tracking-wide disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-hairline-strong bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

// The containing card supplies the chrome; the input is a flat soft-canvas field with a rule beneath.
export const inputClass =
  'w-full rounded-none border-0 border-b border-hairline-strong bg-canvas-soft px-3 py-2.5 text-base font-normal text-ink focus:border-primary focus:outline-2 focus:outline-primary';
export const compactInput =
  'w-full rounded-none border-0 border-b border-hairline-strong bg-canvas-soft px-3 py-2 text-sm font-normal text-ink focus:border-primary focus:outline-2 focus:outline-primary';

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
      <label className="block text-xs font-medium text-body">
        {label}
        <div className="mt-1">{children}</div>
      </label>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-error">
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
        className="w-full max-w-md rounded-card border border-hairline-strong bg-white p-6 shadow-overlay"
      >
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
