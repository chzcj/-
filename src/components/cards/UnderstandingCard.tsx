import type { UnderstandingCardData } from '@/types/childos';

export function UnderstandingCard({ card }: { card: UnderstandingCardData }) {
  return (
    <section className="result-card card">
      <div className="result-title">{card.title}</div>
      {card.isDraft ? <div className="draft-box">这是基于目前信息的初步理解，后续可以继续调整。</div> : null}
      {card.sections.map((section) => (
        <div className="section" key={section.id}>
          <div className="section-title">{section.title}</div>
          <div className="section-body">
            {Array.isArray(section.body)
              ? section.body.map((line) => (
                  <p key={line} style={{ margin: '0 0 8px' }}>
                    {line}
                  </p>
                ))
              : section.body}
          </div>
        </div>
      ))}
      <div className="source-box">专业知识来源：{card.knowledgeSource}</div>
    </section>
  );
}
