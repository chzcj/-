'use client';

import { ChevronRight, Loader2 } from 'lucide-react';

interface EntryCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function EntryCard({ icon, title, description, onClick, disabled, loading }: EntryCardProps) {
  return (
    <button className="entry-card card" type="button" onClick={onClick} disabled={disabled || loading}>
      <span className="icon-box">{icon}</span>
      <span>
        <span className="entry-title">{title}</span>
        <span className="entry-desc">{description}</span>
      </span>
      {loading ? <Loader2 size={18} className="spin-icon" /> : <ChevronRight size={18} color="var(--text-tertiary)" />}
    </button>
  );
}
