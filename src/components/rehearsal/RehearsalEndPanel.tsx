'use client'

import type { RehearsalAnalyzeData } from '@/components/rehearsal/RehearsalOutput'
import { getRehearsalEndCopy } from '@yujian/contracts/rehearsal-end'

export type RehearsalEndPanelProps = {
  endData: RehearsalAnalyzeData | null
  taskSaved: boolean
  tonightSaved: boolean
  onSaveDirection: () => void
  onTryTonight: () => void
  onRestart: () => void
}

export function RehearsalEndPanel({
  endData,
  taskSaved,
  tonightSaved,
  onSaveDirection,
  onTryTonight,
  onRestart,
}: RehearsalEndPanelProps) {
  const copy = getRehearsalEndCopy(endData)

  return (
    <section className="section rehearsal-end-layout">
      <div className="rehearsal-end-hero">
        <p className="profile-hero-kicker">预演完成</p>
        <h1 className="rehearsal-end-heading">这次预演里，我看到的重点</h1>
      </div>

      <article className="rehearsal-end-insight">
        <p className="rehearsal-end-insight-title">预演总结</p>
        <p className="rehearsal-end-insight-body">{copy.summary}</p>
      </article>

      <div className="profile-block">
        <h3>孩子最容易被触发的是</h3>
        <p>{copy.trigger}</p>
      </div>

      <div className="profile-block">
        <h3>今晚可以试的说法</h3>
        <p>{copy.tryTonight}</p>
      </div>

      <div className="profile-block">
        <h3>还不能直接进入档案的内容</h3>
        <p>{copy.archiveNote}</p>
      </div>

      <div className="end-actions rehearsal-end-actions">
        <button type="button" className="secondary-button" onClick={onSaveDirection} disabled={taskSaved}>
          {taskSaved ? '已保存' : '保存这个方向'}
        </button>
        <button type="button" className="primary-button" onClick={onTryTonight} disabled={tonightSaved}>
          {tonightSaved ? '已加入今晚任务' : '今晚试一次'}
        </button>
        <button type="button" className="secondary-button" onClick={onRestart}>
          重新练一遍
        </button>
      </div>
    </section>
  )
}
