import 'server-only'

/* ================================================================
   Embedding 客户端 — 向量检索基础设施（架构-1）
   OpenAI 兼容接口（默认阿里百炼 text-embedding-v3，1024 维）。
   未配置或调用失败时返回 null，检索层据此降级到「取最近」。
   ================================================================ */

const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY || ''
const EMBEDDING_BASE = (process.env.EMBEDDING_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-v3'
// 阿里百炼 text-embedding 单次批量上限为 10 条，超出需分批。
const EMBEDDING_BATCH_SIZE = Math.max(1, Number(process.env.EMBEDDING_BATCH_SIZE || 10))
// 超时：embedding API 卡住时 abort，落到下方 catch 返回 null（检索降级「取最近」），不无限挂。
const EMBEDDING_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS || 15_000)

export function isEmbeddingEnabled(): boolean {
  return Boolean(EMBEDDING_API_KEY && EMBEDDING_MODEL)
}

/** 单批编码（≤ EMBEDDING_BATCH_SIZE 条），失败项为 null。 */
async function embedChunk(texts: string[]): Promise<(number[] | null)[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS)
  try {
    const response = await fetch(`${EMBEDDING_BASE}/embeddings`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${EMBEDDING_API_KEY}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts })
    })
    if (!response.ok) {
      const msg = await response.text().catch(() => '')
      console.error(`[embedding] 请求失败 ${response.status}: ${msg.slice(0, 200)}`)
      return texts.map(() => null)
    }
    const data = (await response.json()) as { data?: Array<{ embedding: number[]; index?: number }> }
    const out: (number[] | null)[] = texts.map(() => null)
    ;(data.data || []).forEach((item, i) => {
      const idx = typeof item.index === 'number' ? item.index : i
      if (Array.isArray(item.embedding) && idx >= 0 && idx < out.length) out[idx] = item.embedding
    })
    return out
  } catch (err) {
    console.error('[embedding] 调用异常:', err)
    return texts.map(() => null)
  } finally {
    clearTimeout(timer)
  }
}

/** 批量编码，自动按 EMBEDDING_BATCH_SIZE 分批。返回与输入等长的数组，失败项为 null。 */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  if (!isEmbeddingEnabled() || texts.length === 0) return texts.map(() => null)
  const out: (number[] | null)[] = []
  for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
    const chunk = texts.slice(start, start + EMBEDDING_BATCH_SIZE)
    const vectors = await embedChunk(chunk)
    out.push(...vectors)
  }
  return out
}

export async function embedText(text: string): Promise<number[] | null> {
  const [vector] = await embedTexts([text])
  return vector
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * 标签预筛后的向量精排：对候选按与 query 的语义相似度降序，取 topK。
 * embedding 不可用时降级为保持原顺序取前 topK（score=0）。
 */
export async function rankByRelevance<T>(
  query: string,
  candidates: T[],
  toText: (candidate: T) => string,
  topK: number
): Promise<Array<{ item: T; score: number }>> {
  if (candidates.length === 0) return []
  if (!isEmbeddingEnabled()) {
    return candidates.slice(0, topK).map((item) => ({ item, score: 0 }))
  }
  const vectors = await embedTexts([query, ...candidates.map(toText)])
  const queryVector = vectors[0]
  if (!queryVector) {
    // embedding 已启用却拿不到 query 向量 = 运行时降级(API 失败/超时)，区别于「未配置」的已知状态，记日志便于排障。
    console.warn('[retrieval] embedding 已启用但 query 向量生成失败，本次降级为按原顺序取最近')
    return candidates.slice(0, topK).map((item) => ({ item, score: 0 }))
  }
  const scored = candidates.map((item, i) => {
    const vector = vectors[i + 1]
    return { item, score: vector ? cosineSimilarity(queryVector, vector) : -1 }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}
