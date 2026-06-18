'use client';

import type { ArchiveDraft } from '@/types/childos';
import { VoiceFieldButton, appendTranscript } from '@/components/voice/VoiceFieldButton';

interface ArchiveCardProps {
  archive: ArchiveDraft;
  editable?: boolean;
  onChange?: (archive: ArchiveDraft) => void;
}

const fields: Array<{ key: keyof ArchiveDraft; label: string }> = [
  { key: 'date', label: '日期' },
  { key: 'eventSummary', label: '今天发生了什么' },
  { key: 'conflictPoint', label: '主要冲突点' },
  { key: 'currentClues', label: '目前了解到的线索' },
  { key: 'rehearsalOrAdvice', label: '沟通预演 / 建议内容' },
  { key: 'observationNext', label: '后续观察点' }
];

export function ArchiveCard({ archive, editable, onChange }: ArchiveCardProps) {
  return (
    <section className="result-card card">
      <div className="result-title">孩子档案草稿</div>
      {fields.map((field) => {
        const value = String(archive[field.key] || '');
        return (
          <div className="section" key={field.key}>
            <div className="section-title">{field.label}</div>
            {editable ? (
              <>
                <textarea
                  className="text-field"
                  value={value}
                  onChange={(event) => onChange?.({ ...archive, [field.key]: event.target.value })}
                  style={{ minHeight: field.key === 'date' ? 48 : 104 }}
                />
                {field.key !== 'date' ? (
                  <VoiceFieldButton
                    compact
                    onTranscript={(t) => onChange?.({ ...archive, [field.key]: appendTranscript(value, t) })}
                    style={{ marginTop: 8 }}
                  />
                ) : null}
              </>
            ) : (
              <div className="section-body">{value}</div>
            )}
          </div>
        );
      })}
    </section>
  );
}
