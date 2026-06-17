'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function PrimaryButton({ children, loading, disabled, ...props }: ButtonProps) {
  const label = props['aria-label'] || buttonLabel(children, loading);
  return (
    <button className="primary-button" type="button" disabled={disabled || loading} aria-busy={loading || undefined} aria-label={label} {...props}>
      <span className={loading ? 'button-content is-loading' : 'button-content'}>{loading ? '正在整理...' : children}</span>
      {loading ? <Loader2 className="button-spinner" size={17} aria-hidden="true" /> : null}
    </button>
  );
}

export function SecondaryButton({ children, loading, disabled, ...props }: ButtonProps) {
  const label = props['aria-label'] || buttonLabel(children, loading);
  return (
    <button className="secondary-button" type="button" disabled={disabled || loading} aria-busy={loading || undefined} aria-label={label} {...props}>
      <span className={loading ? 'button-content is-loading' : 'button-content'}>{loading ? '正在整理...' : children}</span>
      {loading ? <Loader2 className="button-spinner" size={17} aria-hidden="true" /> : null}
    </button>
  );
}

function buttonLabel(children: React.ReactNode, loading?: boolean): string | undefined {
  if (loading) return '正在整理...';
  const parts: string[] = [];
  React.Children.forEach(children, (child) => {
    if (typeof child === 'string' || typeof child === 'number') parts.push(String(child));
  });
  const text = parts.join('').trim();
  return text || undefined;
}
