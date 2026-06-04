'use client';

import type { QuickChoice } from '@/types/childos';

interface QuestionCardProps {
  question: string;
  hint?: string;
  badge?: string;
  choices?: QuickChoice[];
  disabled?: boolean;
  onChoiceClick?: (value: string) => void;
}

export function QuestionCard({ question, hint, badge, choices, disabled, onChoiceClick }: QuestionCardProps) {
  return (
    <section className="question-card card">
      {badge ? <div className="badge">{badge}</div> : null}
      <div className="question-text">{question}</div>
      {hint ? <div className="hint-text">{hint}</div> : null}
      {choices?.length ? (
        <div className="choice-row">
          {choices.map((choice) => (
            <button className="chip" type="button" key={choice.value} disabled={disabled} onClick={() => onChoiceClick?.(choice.value)}>
              {choice.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
