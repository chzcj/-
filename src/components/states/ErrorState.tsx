'use client';

import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';

interface ErrorStateProps {
  title: string;
  description: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export function ErrorState({ title, description, primaryLabel, secondaryLabel, onPrimary, onSecondary }: ErrorStateProps) {
  return (
    <div className="loading-wrap">
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{description}</p>
      <div className="button-row" style={{ width: '100%' }}>
        {secondaryLabel ? <SecondaryButton onClick={onSecondary}>{secondaryLabel}</SecondaryButton> : null}
        {primaryLabel ? <PrimaryButton onClick={onPrimary}>{primaryLabel}</PrimaryButton> : null}
      </div>
    </div>
  );
}
