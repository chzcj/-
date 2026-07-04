import type { DailySection } from '@/types/daily-message'

function sectionPlainTexts(sections: DailySection[]): string[] {
  const out: string[] = []
  for (const s of sections) {
    if (s.paragraphs) out.push(...s.paragraphs)
    if (s.items) out.push(...s.items)
    if (s.quotes) out.push(...s.quotes)
  }
  return out.map((t) => t.trim()).filter(Boolean)
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, '').replace(/[「」""''…]/g, '')
}

/** 正文与 section 重复时裁剪，避免 prose 复述结构化块 */
export function dedupeProseFromSections(prose: string, sections: DailySection[]): string {
  const trimmed = prose.trim()
  if (!trimmed || sections.length === 0) return trimmed

  const blocks = sectionPlainTexts(sections)
  let result = trimmed

  for (const block of blocks) {
    if (block.length < 12) continue
    const needle = block.slice(0, Math.min(block.length, 48))
    const normNeedle = normalizeForCompare(needle)
    const normResult = normalizeForCompare(result)
    if (normNeedle.length >= 12 && normResult.includes(normNeedle)) {
      result = result.replace(block, '').replace(needle, '').trim()
    }
  }

  result = result.replace(/\s{2,}/g, ' ').trim()

  if (result.length >= 8) return result

  const sentences = trimmed.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean)
  for (const sentence of sentences) {
    const norm = normalizeForCompare(sentence)
    const duplicated = blocks.some((b) => {
      const nb = normalizeForCompare(b)
      return nb.includes(norm) || norm.includes(nb.slice(0, Math.min(nb.length, norm.length + 8)))
    })
    if (!duplicated && sentence.length >= 6) return sentence
  }

  return trimmed.length > 60 ? `${trimmed.slice(0, 56)}…` : trimmed
}
