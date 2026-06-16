import { NextResponse } from 'next/server'
import { callFastJson } from '@/lib/server/ark-agents'
import { verifyInternalApi, authError } from '@/lib/server/auth-guard'
import { ingestEpisode } from '@/lib/server/memory/episode/pipeline'

const TITLE_MAP: Record<string, string> = {
  study: '学习作业', routine: '手机与日常节奏',
  communication: '亲子沟通', emotion: '情绪压力', environment: '关系环境',
}

export async function POST(request: Request) {
  if (!verifyInternalApi(request)) return authError()

  try {
    const body = await request.json()
    const { entryType, rawText, stage } = body
    if (!entryType || !rawText) {
      return NextResponse.json({ ok: false, error: { code: 'BAD_REQUEST', message: '缺少 entryType 或 rawText' } }, { status: 400 })
    }

    const topic = TITLE_MAP[entryType] || entryType

    if (stage === 'summary') {
      const result = await callFastJson<{
        mainJudgment: string; facts: string[]; pendingHypotheses: string[]; note: string
      }>(
        `你是 ChildOS 的阶段总结 agent。家长在"${topic}"入口填了一段描述。请你根据这段输入，写一个阶段总结。
要求：mainJudgment 写当前阶段的核心判断（不贴标签，不直接采信家长的评价词如懒/不自觉/沉迷）；facts 提取 2-4 个可验证事实；pendingHypotheses 提 2-3 个候选假设（用"可能"开头）；note 写后续值得继续观察的方向。
只输出 JSON，不输出 Markdown 或解释。`,
        { entryType, rawText }
      ).catch(() => undefined)

      // 入口采集完成时抽取 Episode（首次建模的真实生活片段，异步不阻塞）
      void ingestEpisode(rawText, { sourceEventId: `entry_${entryType}` })

      return NextResponse.json({ ok: true, data: result })
    }

    const followUp = await callFastJson<{
      shouldAsk: boolean; purpose: string; directions: string[]; voicePrompt: string
    }>(
      `你是 ChildOS 的入口追问 agent。家长在"${topic}"入口输入了一段描述。根据这段描述生成一个追问。
要求：purpose 一句话说明追问的精确目的（帮家长把现场看得更具体）；directions 给 3-4 个候选思考方向（短标签）；voicePrompt 给一句口语化的追问提示（像面谈老师在问）。
只输出 JSON，不输出 Markdown 或解释。`,
      { entryType, rawText }
    ).catch(() => undefined)

    return NextResponse.json({ ok: true, data: followUp })
  } catch (error) {
    return NextResponse.json({ ok: false, error: { code: 'ENTRY_ERROR', message: String(error) } }, { status: 500 })
  }
}
