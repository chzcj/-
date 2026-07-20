import { Suspense } from 'react'
import { MemoriesClient } from './MemoriesClient'

export default function MemoriesPage() {
  return (
    <Suspense fallback={<p className="hint-text">正在整理…</p>}>
      <MemoriesClient />
    </Suspense>
  )
}
