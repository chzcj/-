// 向量检索验证脚本 — 对比「向量精排」与「取最近」的检索质量
// 用法：EMBEDDING_API_KEY=xxx node scripts/test-vector-retrieval.mjs
// key 仅从环境变量读取，不写入文件。

const KEY = process.env.EMBEDDING_API_KEY || process.env.DASHSCOPE_API_KEY || ''
const BASE = (process.env.EMBEDDING_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
const MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-v3'

if (!KEY) {
  console.error('缺少 EMBEDDING_API_KEY 环境变量')
  process.exit(1)
}

async function embedTexts(texts) {
  // 阿里百炼批量上限 10 条，分批请求
  const out = []
  for (let s = 0; s < texts.length; s += 10) {
    const chunk = texts.slice(s, s + 10)
    const res = await fetch(`${BASE}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, input: chunk }),
    })
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
    const data = await res.json()
    const part = chunk.map(() => null)
    ;(data.data || []).forEach((item, i) => {
      const idx = typeof item.index === 'number' ? item.index : i
      part[idx] = item.embedding
    })
    out.push(...part)
  }
  return out
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

// 模拟一个家庭的历史日常事件池（按时间顺序，最近的在末尾）
const history = [
  '孩子周末和同学打篮球很开心',
  '数学作业又拖到十点才开始写',
  '孩子说不想去补习班了',
  '晚饭后主动把碗洗了',
  '写英语作文卡住就开始玩手机',
  '和爸爸因为收手机吵了一架',
  '这次月考没考好但没太在意',
  '最近开始能早睡了',
  '周末去外婆家玩了一整天',
  '今天心情不错，主动聊了学校的事',
]
const query = '孩子一写作业就拖延，磨蹭半天不肯开始'

const run = async () => {
  console.log(`查询（当前家长输入）：${query}\n`)
  const vectors = await embedTexts([query, ...history])
  const qv = vectors[0]
  const scored = history.map((text, i) => ({ text, score: cosine(qv, vectors[i + 1]) }))
  const ranked = [...scored].sort((a, b) => b.score - a.score)

  console.log('【向量精排】最相关的 5 条：')
  ranked.slice(0, 5).forEach((r, i) => console.log(`  ${i + 1}. ${r.score.toFixed(4)}  ${r.text}`))

  console.log('\n【旧逻辑·取最近】最近的 5 条：')
  history.slice(-5).forEach((t, i) => {
    const s = scored.find(x => x.text === t).score
    console.log(`  ${i + 1}. ${s.toFixed(4)}  ${t}`)
  })

  const vecAvg = ranked.slice(0, 5).reduce((s, r) => s + r.score, 0) / 5
  const recentAvg = history.slice(-5).reduce((s, t) => s + scored.find(x => x.text === t).score, 0) / 5
  console.log(`\n平均相关度：向量精排 ${vecAvg.toFixed(4)}  vs  取最近 ${recentAvg.toFixed(4)}`)
  console.log(`向量精排相关度提升 ${((vecAvg / recentAvg - 1) * 100).toFixed(0)}%`)
}

run().catch((e) => { console.error('失败：', e.message); process.exit(1) })
