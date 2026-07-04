'use client'

import type { DailyThinkingChip } from '@/types/daily-message'

export function DailyThinkingPanel({ chips }: { chips: DailyThinkingChip[] }) {
  return (
    <div className="thinking-panel">
      <div className="thinking-header">
        <span className="thinking">
          正在结合孩子的历史信息思考
          <span className="thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </span>
      </div>
      <div className="profile-stream">
        {chips.map((chip) => (
          <div key={chip.label} className="profile-chip">
            <span>{chip.label}</span>
            <strong>{chip.text}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
