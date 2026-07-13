'use client';

import { useRouter } from 'next/navigation';

/** 全局错误边界：不依赖任何布局壳/样式系统（出错时它们可能正是崩溃源），内联 hi-fi 配色。 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '0 32px',
        background: '#f8f6e5',
        color: '#3c4030',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700 }}>页面刚刚没有顺利显示</div>
      <div style={{ fontSize: 14, color: '#868b94' }}>可以再试一次，或者回到交流页。</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          onClick={reset}
          style={{
            padding: '10px 22px',
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #a7d77a, #7fb964)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          重试
        </button>
        <button
          onClick={() => router.push('/daily')}
          style={{
            padding: '10px 22px',
            borderRadius: 14,
            border: '1px solid rgba(73, 91, 45, 0.18)',
            background: '#fff',
            color: '#3c4030',
            fontSize: 15,
          }}
        >
          回到交流
        </button>
      </div>
    </div>
  );
}
