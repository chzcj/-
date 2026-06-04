import type { RehearsalResultData } from '@/types/childos';

export function RehearsalResultCard({ result }: { result: RehearsalResultData }) {
  return (
    <section className="result-card card">
      <div className="result-title">这句话在孩子那里可能会变成什么</div>
      <div className="section">
        <div className="section-title">你原本可能会这样说</div>
        <div className="quote-box">{result.parentOriginal}</div>
      </div>
      <div className="section">
        <div className="section-title">孩子可能听成</div>
        <div className="section-body">{result.childMayHear}</div>
      </div>
      <div className="section">
        <div className="section-title">可能引发的反应</div>
        <div className="section-body">{result.likelyReaction}</div>
      </div>
      <div className="section">
        <div className="section-title">更稳妥的表达</div>
        <div className="quote-box">{result.saferExpression}</div>
      </div>
      <div className="section">
        <div className="section-title">为什么这样更稳</div>
        <div className="section-body">{result.reason}</div>
      </div>
    </section>
  );
}
