import type { AdviceCardData } from '@/types/childos';

export function AdviceCard({ card }: { card: AdviceCardData }) {
  return (
    <section className="result-card card">
      <div className="result-title">建议卡</div>
      <p className="section-body" style={{ marginTop: 0 }}>
        {card.intro}
      </p>
      {card.items.slice(0, 4).map((item) => (
        <div className="section" key={item.title}>
          <div className="section-title">{item.title}</div>
          {item.avoid ? <div className="section-body">先别这样说：{item.avoid}</div> : null}
          {item.tryThis ? <div className="quote-box">{item.tryThis}</div> : null}
          {item.body ? <div className="section-body">{item.body}</div> : null}
          {item.observe ? <div className="section-body">先观察：{item.observe}</div> : null}
        </div>
      ))}
    </section>
  );
}
