'use client';

import { useEffect, useState } from 'react';

interface LoadingResultProps {
  title: string;
  messages: string[];
}

export function LoadingResult({ title, messages }: LoadingResultProps) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!messages.length) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % messages.length), 1500);
    return () => window.clearInterval(timer);
  }, [messages.length]);
  return (
    <div className="loading-wrap">
      <div className="loader" />
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{messages[index] || ''}</p>
    </div>
  );
}
