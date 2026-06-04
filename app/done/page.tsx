'use client';

import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { DoneState } from '@/components/states/DoneState';

export default function DonePage() {
  const router = useRouter();
  return (
    <AppShell>
      <div className="page without-voice">
        <DoneState title="今天的问题已经整理好了" description="本次理解已经存入孩子档案，后续可以继续回来补充。" actionLabel="回到主页面" onAction={() => router.push('/home')} />
      </div>
    </AppShell>
  );
}
