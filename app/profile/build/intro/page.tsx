'use client'

import { ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { HiFiBuildHero } from '@/components/profile/HiFiBuildHero'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { markBuildIntroSeen } from '@/lib/storage/childStorage'

const softCards = [
  {
    title: '每页建议说 30 秒以上',
    body: '接下来会分四个模块听你讲孩子的日常、作业、沟通和家庭支持。尽量讲真实过程，不用总结性格。',
  },
  {
    title: '轻提示只补关键细节',
    body: '系统会轻提示你补充关键细节；每段录入后还有一步追问，帮你把场景补完整。前台不会展示打分、表格或测评结果。',
  },
  {
    title: '这些内容会用于孩子画像',
    body: '后续交流分析、沟通预演、任务建议和画像更新都会参考这份背景，让建议更贴近你们家的真实情境。',
  },
] as const

export default function ProfileBuildIntroPage() {
  const router = useRouter()

  function handleStart() {
    markBuildIntroSeen()
    router.push('/profile/build/basic')
  }

  return (
    <HiFiBuildShell
      topTitle="先说几段真实情况"
      stepLabel="开始前"
      progress={12}
      actions={[
        {
          label: '开始录入',
          icon: <ArrowRight size={18} />,
          onClick: handleStart,
        },
      ]}
    >
      <HiFiBuildHero
        title="接下来不是填问卷"
        copy="像聊天一样留下真实过程，系统再帮你整理成后续分析能用的背景。"
        mascot
      />

      {softCards.map((card) => (
        <section key={card.title} className="section">
          <div className="soft-card">
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </div>
        </section>
      ))}
    </HiFiBuildShell>
  )
}
