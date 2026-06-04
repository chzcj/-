'use client';

import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function PrimaryButton({ children, loading, disabled, ...props }: ButtonProps) {
  return (
    <button className="primary-button" type="button" disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      <span className={loading ? 'button-content is-loading' : 'button-content'}>{loading ? '正在整理...' : children}</span>
      {loading ? <Loader2 className="button-spinner" size={17} aria-hidden="true" /> : null}
    </button>
  );
}

export function SecondaryButton({ children, loading, disabled, ...props }: ButtonProps) {
  return (
    <button className="secondary-button" type="button" disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      <span className={loading ? 'button-content is-loading' : 'button-content'}>{loading ? '正在整理...' : children}</span>
      {loading ? <Loader2 className="button-spinner" size={17} aria-hidden="true" /> : null}
    </button>
  );
}
