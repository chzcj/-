'use client';

import { ChevronLeft, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface TopProgressBarProps {
  title?: string;
  status?: string;
  progress?: number;
  showProgress?: boolean;
  leftAction?: 'close' | 'back' | 'none';
  onLeftClick?: () => void;
}

export function TopProgressBar({
  title,
  status,
  progress = 0,
  showProgress = true,
  leftAction = 'back',
  onLeftClick
}: TopProgressBarProps) {
  const router = useRouter();
  const Icon = leftAction === 'close' ? X : ChevronLeft;

  return (
    <div className="topbar">
      {leftAction !== 'none' ? (
        <button className="icon-button" type="button" onClick={onLeftClick || (() => router.back())} aria-label={leftAction === 'close' ? '关闭' : '返回'}>
          <Icon size={18} />
        </button>
      ) : null}
      <div className="topbar-main">
        {showProgress ? (
          <>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            </div>
            {status ? <div className="status-text">{status}</div> : null}
          </>
        ) : (
          <div className="entry-title">{title}</div>
        )}
      </div>
    </div>
  );
}
