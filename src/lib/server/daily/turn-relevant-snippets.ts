import type { FrontendReadSchema } from '@/lib/server/daily/frontend-read-pack'

const STOP = new Set([
  '孩子', '家长', '今天', '最近', '一下', '怎么', '什么', '有没有', '是不是', '可以', '我们', '他们', '这个', '那个', '然后', '因为', '所以', '还是', '就是', '已经', '觉得', '知道', '没有', '一个', '一下', '真的', '谢谢', '你好', '好的',
])

function tokenize(text: string): string[] {
  const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
  const parts = cleaned.split(/\s+/).filter((t) => t.length >= 2 && !STOP.has(t))
  const chars: string[] = []
  for (const seg of text.match(/[\u4e00-\u9fa5]{2,4}/g) || []) {
    if (!STOP.has(seg)) chars.push(seg)
  }
  return [...new Set([...parts, ...chars])]
}

function scoreSnippet(snippet: string, tokens: string[]): number {
  let score = 0
  for (const t of tokens) {
    if (snippet.includes(t)) score += t.length >= 3 ? 2 : 1
  }
  return score
}

/** 按 userText 对 pack 做轻量 relevance 排序，供 prose payload 预筛 top N */
export function pickTurnRelevantSnippets(
  userText: string,
  pack: FrontendReadSchema,
  limit = 5
): string[] {
  const tokens = tokenize(userText)
  const pool = [
    ...pack.entryFacts,
    ...pack.childQuotes,
    ...pack.parentVerbatimSnippets,
    ...pack.dossierSlice,
    ...pack.recentEvents,
    ...pack.familyPatterns,
  ].filter(Boolean)

  if (!pool.length) return []
  if (!tokens.length) return pool.slice(0, limit)

  const ranked = [...new Set(pool)]
    .map((snippet) => ({ snippet, score: scoreSnippet(snippet, tokens) }))
    .sort((a, b) => b.score - a.score || b.snippet.length - a.snippet.length)

  const picked = ranked.filter((r) => r.score > 0).slice(0, limit)
  if (picked.length >= Math.min(2, limit)) return picked.map((r) => r.snippet)
  return ranked.slice(0, limit).map((r) => r.snippet)
}
