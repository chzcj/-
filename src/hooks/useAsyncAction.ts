'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  options?: { onError?: (message: string) => void }
) {
  const mountedRef = useRef(true);
  const runningRef = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: TArgs) => {
      if (runningRef.current) return undefined;
      runningRef.current = true;
      if (mountedRef.current) setLoading(true);
      try {
        return await action(...args);
      } catch (error) {
        options?.onError?.('今天有点忙，我们稍后再试。');
        return undefined;
      } finally {
        runningRef.current = false;
        if (mountedRef.current) setLoading(false);
      }
    },
    [action, options]
  );

  return { run, loading };
}
