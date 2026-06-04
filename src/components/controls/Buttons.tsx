'use client';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function PrimaryButton({ children, loading, disabled, ...props }: ButtonProps) {
  return (
    <button className="primary-button" type="button" disabled={disabled || loading} {...props}>
      {loading ? '正在整理...' : children}
    </button>
  );
}

export function SecondaryButton({ children, loading, disabled, ...props }: ButtonProps) {
  return (
    <button className="secondary-button" type="button" disabled={disabled || loading} {...props}>
      {loading ? '正在整理...' : children}
    </button>
  );
}
