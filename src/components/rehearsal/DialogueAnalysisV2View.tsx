'use client'

import type {
  DialogueAnalysisV2,
  DialogueDossierCell,
  DialoguePhase,
  DialoguePhaseQuote,
  DialogueSampleLine,
  DialogueTryTonightStep,
} from '@yujian/contracts/rehearsal-dialogue'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { getChildDisplayName } from '@/lib/storage/childStorage'

export type DialogueAnalysisViewProps = {
  summary: string
  v2: DialogueAnalysisV2
  onGoRehearsal?: () => void
  onBack?: () => void
}

export function DialogueAnalysisV2View({
  summary,
  v2,
  onGoRehearsal,
  onBack,
}: DialogueAnalysisViewProps) {
  const childCopy = childSystemCopy(getChildDisplayName())
  const meta = v2.meta
  const phaseCount = meta?.phaseCount ?? v2.phases.length
  const highlightCount =
    meta?.totalQuoteCount ??
    v2.phases.reduce((n: number, p: DialoguePhase) => n + p.quotes.length, 0)

  return (
    <div className="da-result-flow">
      <div className="da-meta-row">
        {meta?.sceneLabel ? <span className="da-meta-pill">{meta.sceneLabel}</span> : null}
        {meta?.durationHint ? <span className="da-meta-pill">{meta.durationHint}</span> : null}
        {summary && !meta?.sceneLabel ? <span className="da-meta-pill">{summary}</span> : null}
        <span className="da-meta-pill da-meta-pill--accent">
          {phaseCount} 段 · 精选 {highlightCount} 句
        </span>
      </div>

      <p className="overview-kicker">{childCopy.inSceneMemory}</p>
      <div className="da-dossier-strip">
        {v2.dossierCells.map((cell: DialogueDossierCell) => (
          <div key={cell.label} className="da-dossier-cell">
            <span className="da-dossier-label">{cell.label}</span>
            <p className="da-dossier-body">{cell.body}</p>
          </div>
        ))}
      </div>

      <article className="da-synthesis">
        <h3 className="da-synthesis-title">讲清</h3>
        <p className="da-synthesis-body">{v2.synthesis}</p>
      </article>

      <p className="da-rhythm-map-lede">
        按对话节奏拆成 {phaseCount} 段，每段只留最亮的原话——读起来像「场景地图」，不是流水账转写。
      </p>

      {v2.phases.map((phase: DialoguePhase) => (
        <section key={phase.title} className="da-phase-block">
          <div className="da-phase-head">
            <h2 className="da-phase-title">{phase.title}</h2>
            {phase.quoteCountHint ? <span className="da-meta-pill">{phase.quoteCountHint}</span> : null}
          </div>
          <p className="da-phase-profile">{phase.profileMatch}</p>
          <ul className="da-phase-quotes">
            {phase.quotes.map((q: DialoguePhaseQuote) => (
              <li key={`${phase.title}-${q.text.slice(0, 12)}`} className="da-phase-quote">
                <strong>{q.speaker}：</strong>「{q.text}」
                {q.isPeak ? <span className="da-trigger-tag">峰值</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="da-action-block">
        <span className="da-action-block__badge">今晚可试</span>
        <p className="da-action-block__lead">拆成两步，照着做就行：</p>
        <ol className="da-step-list">
          {v2.tryTonightSteps.map((step: DialogueTryTonightStep) => (
            <li key={step.label} className="da-step-item">
              <span className="da-step-label">{step.label}</span>
              <p className="da-step-text">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>

      {v2.sampleLines.length ? (
        <article className="da-sample-card">
          <h3 className="da-sample-card__title">示范开口 · 完整一轮</h3>
          {v2.sampleScene ? <p className="da-sample-card__scene">{v2.sampleScene}</p> : null}
          <ul className="da-sample-lines">
            {v2.sampleLines.map((line: DialogueSampleLine, i: number) => (
              <li key={i} className="da-sample-line">
                <span className={`role${line.role === '家长' ? ' is-parent' : ''}`}>{line.role}</span>
                {line.stageDirection ? `（${line.stageDirection}）` : ''}
                {line.text}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <div className="result-actions">
        {onGoRehearsal ? (
          <button type="button" className="primary-button wide-button" onClick={onGoRehearsal}>
            用这次对话去情景预演
          </button>
        ) : null}
        {onBack ? (
          <button type="button" className="secondary-button wide-button" onClick={onBack}>
            返回预演
          </button>
        ) : null}
      </div>
    </div>
  )
}
