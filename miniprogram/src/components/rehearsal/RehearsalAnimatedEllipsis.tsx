import { Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import './RehearsalAnimatedEllipsis.scss'

const FRAMES = ['.', '..', '...'] as const

type Props = {
  /** 大气泡 / 灰色 insight 小框 */
  variant?: 'bubble' | 'insight'
}

export function RehearsalAnimatedEllipsis({ variant = 'insight' }: Props) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % FRAMES.length)
    }, 420)
    return () => clearInterval(timer)
  }, [])

  const className =
    variant === 'bubble'
      ? 'rehearsal-bubble-text rehearsal-animated-ellipsis rehearsal-animated-ellipsis--bubble'
      : 'rehearsal-child-insight-body rehearsal-animated-ellipsis rehearsal-animated-ellipsis--insight'

  return (
    <Text className={className} aria-hidden>
      {FRAMES[frame]}
    </Text>
  )
}
