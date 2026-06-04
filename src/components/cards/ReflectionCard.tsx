interface ReflectionCardProps {
  title?: string;
  text: string;
}

export function ReflectionCard({ title = '我先看到一点线索', text }: ReflectionCardProps) {
  return (
    <section className="reflection-card">
      <div className="reflection-title">{title}</div>
      <div className="reflection-text">{text}</div>
    </section>
  );
}
