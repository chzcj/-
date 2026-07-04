#!/usr/bin/env node
/**
 * SecondMe 日常交流语料质量审查（规则打分，对齐 GPT 审查清单）
 *
 * 用法:
 *   node scripts/audit-daily-secondme.mjs scripts/test-reports/xiaoyin-corpus-*.json
 *   CORPUS_PHASE=daily node scripts/test-xiaoyin-corpus.mjs && node scripts/audit-daily-secondme.mjs scripts/test-reports/xiaoyin-corpus-*.json
 */
import fs from 'node:fs'
import path from 'node:path'

const PLACEHOLDER_RE =
  /测试画像|生命周期测试|画像\s*ID|profile[_\s-]?id|178\d{6,}|当前输入可被已有画像解释/i
const TEMPLATE_CHILD_VOICE_RE =
  /我不是完全不想认真|别人抄也能过|我不是懒，我是怕/i

function loadReport(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

function collectDailySteps(report) {
  return (report.steps || []).filter((s) => s.phase === 'daily' && s.ok)
}

function auditCase(step) {
  const prose = step.output?.reading || step.output?.text || step.output?.prose || ''
  const sections = step.output?.sections || step.output?.cards?.sections || []
  const labels = sections.map((s) => s.label || s.id).join(' ')
  const sectionText = sections
    .flatMap((s) => [...(s.paragraphs || []), ...(s.quotes || []), s.body || ''].filter(Boolean))
    .join('\n')
  const full = `${prose}\n${sectionText}\n${labels}`

  const fails = []
  const warnings = []

  if (PLACEHOLDER_RE.test(full)) fails.push('placeholder_pollution')
  if (TEMPLATE_CHILD_VOICE_RE.test(sectionText) && !/抄|数学|作业/.test(step.input || '')) {
    warnings.push('templated_child_voice')
  }
  if (/判断依据|画像分析|孩子视角/.test(labels)) warnings.push('legacy_section_labels')
  if (sections.filter((s) => !s.hidden).length > 4) fails.push('too_many_visible_sections')
  const visible = sections.filter((s) => !s.hidden)
  const dupIds = new Set()
  const ids = visible.map((s) => s.id)
  if (new Set(ids).size !== ids.length) fails.push('duplicate_section_ids')

  for (const s of sections) {
    if (s.id === 'why_revisit' && /当前输入可被已有画像解释/.test((s.paragraphs || []).join(''))) {
      fails.push('counter_evidence_template')
    }
  }

  const score = Math.max(0, 10 - fails.length * 3 - warnings.length)
  return {
    id: step.id || step.caseId,
    input: step.input,
    score,
    pass: fails.length === 0 && score >= 7,
    fails,
    warnings,
    proseLen: prose.length,
    visibleSections: visible.length,
  }
}

function main() {
  const fileArg = process.argv[2]
  if (!fileArg) {
    console.error('Usage: node scripts/audit-daily-secondme.mjs <corpus-report.json>')
    process.exit(1)
  }
  const filePath = path.resolve(fileArg)
  const report = loadReport(filePath)
  const daily = collectDailySteps(report)
  const results = daily.map(auditCase)
  const passed = results.filter((r) => r.pass).length
  const avg = results.length ? results.reduce((a, r) => a + r.score, 0) / results.length : 0

  const out = {
    source: filePath,
    auditedAt: new Date().toISOString(),
    total: results.length,
    passed,
    failed: results.length - passed,
    avgScore: Number(avg.toFixed(2)),
    results,
  }

  const outPath = filePath.replace(/\.json$/, '-secondme-audit.json')
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
  console.log(`SecondMe audit: ${passed}/${results.length} pass, avg ${out.avgScore}`)
  console.log(`Report: ${outPath}`)
  if (out.failed > 0) process.exit(1)
}

main()
