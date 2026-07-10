import { useEffect, useState } from 'react'

/** 挂载后短暂添加 page-entering class（对齐 Web 进场动效） */
export function usePageEntering(durationMs = 400) {
  const [entering, setEntering] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), durationMs)
    return () => clearTimeout(timer)
  }, [durationMs])

  return entering
}
