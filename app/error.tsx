'use client';

import { useRouter } from 'next/navigation';
import { PrimaryButton, SecondaryButton } from '@/components/controls/Buttons';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorState } from '@/components/states/ErrorState';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  return (
    <AppShell>
      <div className="page without-voice">
        <ErrorState title="页面刚刚没有顺利显示" description="可以再试一次，或者先回到首页。" />
        <div className="button-row" style={{ marginTop: 14 }}>
          <PrimaryButton onClick={reset}>重试</PrimaryButton>
          <SecondaryButton onClick={() => router.push('/home')}>返回首页</SecondaryButton>
        </div>
      </div>
    </AppShell>
  );
}
