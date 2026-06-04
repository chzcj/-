'use client';

import { Check } from 'lucide-react';

interface DoneStateProps {
  title: string;
  description?: string;
  actionLabel: string;
  onAction: () => void;
}

export function DoneState({ title, description, actionLabel, onAction }: DoneStateProps) {
  return (
    <div className="done-wrap">
      <div className="done-mark">
        <Check size={34} />
      </div>
      <h1 className="page-title">{title}</h1>
      {description ? <p className="page-subtitle">{description}</p> : null}
      <button type="button" className="chip" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
