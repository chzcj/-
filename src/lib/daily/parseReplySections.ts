/** 从 AI 前台回复中解析高保真结构化段落（零 LLM，启发式） */
export type ReplySection = { label: string; body: string }

const SECTION_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: '孩子可能先听成', re: /(?:孩子可能(?:先)?听成|他(?:可能)?会先听成)[：:]\s*([\s\S]+?)(?=\n\n|为什么|依据|方向|$)/ },
  { label: '为什么这样看', re: /(?:为什么这样看|判断依据|结合之前)[：:]\s*([\s\S]+?)(?=\n\n|一个方向|建议|$)/ },
  { label: '一个方向', re: /(?:一个方向|简略方向|今晚可先)[：:]\s*([\s\S]+?)$/ },
]

export function parseReplySections(text: string): ReplySection[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const sections: ReplySection[] = []
  for (const { label, re } of SECTION_PATTERNS) {
    const m = trimmed.match(re)
    if (m?.[1]?.trim()) sections.push({ label, body: m[1].trim() })
  }

  if (sections.length >= 2) return sections

  const paragraphs = trimmed.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length >= 3 && paragraphs.every((p) => p.length < 280)) {
    return [
      { label: '看见孩子', body: paragraphs[0] },
      { label: '为什么这样看', body: paragraphs[1] },
      { label: '一个方向', body: paragraphs.slice(2).join('\n\n') },
    ]
  }

  return []
}
