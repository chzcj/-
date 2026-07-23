#!/usr/bin/env node
/**
 * 全链路记忆利用率审计（只读）
 * 用法：
 *   node scripts/audit-memory-utilization.mjs [--json] [--tenant=f_demo:c_demo]
 *   DATABASE_URL=... node scripts/audit-memory-utilization.mjs  # 含读包填充率
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const args = process.argv.slice(2)
const asJson = args.includes('--json')
const tenantArg = args.find((a) => a.startsWith('--tenant='))
const [familyId = 'f_demo', childId = 'c_demo'] = tenantArg
  ? tenantArg.split('=')[1].split(':')
  : ['f_demo', 'c_demo']

const report = {
  auditDate: new Date().toISOString(),
  tenant: { familyId, childId },
  sections: {},
}

// ── 1. Hidden section payload diff（静态）──
{
  const src = read('src/lib/server/daily/parent-facing-copy.ts')
  const slimBlock = src.match(
    /frontendPack\.dossierSlice\?\.length[\s\S]*?\? \{([\s\S]*?)\}\s*:\s*buildDailyProsePayload/
  )
  const slimKeys = slimBlock
    ? [...slimBlock[1].matchAll(/^\s*(\w+):/gm)].map((m) => m[1])
    : []
  const proseSrc = read('src/lib/server/daily/prose-context.ts')
  const packKeysMatch = proseSrc.match(/retrievalPack[\s\S]*?pickFrontendReadPack/)
  const fullPayloadUsesRetrievalPack = proseSrc.includes('retrievalPack: pack')
  report.sections.hiddenPayloadDiff = {
    breakpointOpen: slimKeys.length > 0 && !slimKeys.includes('retrievalPack'),
    whenDossierSliceNonEmpty: slimKeys,
    whenDossierSliceEmpty: ['buildDailyProsePayload → retrievalPack (11 keys)', 'deepModelDigest', 'packReadingGuide', 'packStats', 'writingRules'],
    paradox: 'dossier 越厚，hidden section 越丢 entryFacts/childQuotes/parentVerbatimSnippets',
    file: 'src/lib/server/daily/parent-facing-copy.ts:106-117',
    fullPayloadUsesRetrievalPack,
  }
}

// ── 2. 契约 drift：read-contract vs SLICE_LIMITS_THICK ──
{
  const packSrc = read('src/lib/server/daily/frontend-read-pack.ts')
  const thickMatch = packSrc.match(/SLICE_LIMITS_THICK[\s\S]*?= \{([\s\S]*?)\n\}/)
  const codeLimits = {}
  if (thickMatch) {
    for (const m of thickMatch[1].matchAll(/(\w+):\s*(\d+)/g)) {
      codeLimits[m[1]] = Number(m[2])
    }
  }
  const docLimits = {
    childStructureModels: 12,
    entryEvidence: 12,
    entryFacts: 80,
    dossierSlice: 24,
    matchedMechanisms: 8,
    familyPatterns: 10,
    parentUnderstanding: 12,
    recentEvents: 12,
    pendingHypotheses: 10,
    childQuotes: 16,
    parentVerbatimSnippets: 16,
  }
  const drift = []
  for (const [k, docVal] of Object.entries(docLimits)) {
    const codeVal = codeLimits[k]
    if (codeVal !== undefined && codeVal !== docVal) {
      drift.push({ key: k, doc: docVal, code: codeVal })
    }
  }
  report.sections.contractDrift = {
    aligned: ['entryFacts', 'dossierSlice', 'matchedMechanisms'].filter(
      (k) => docLimits[k] === codeLimits[k]
    ),
    drift,
    layerNaming: {
      doc: 'family_interaction_cycles',
      code: 'interaction_cycles',
      file: 'memory_layer_items.layer_name',
    },
    memoryWriteDocDrift: read('docs/contracts/memory-write.md').includes('deep_mechanism_review(每日桶)')
      ? 'doc may say daily bucket chains deep_mechanism'
      : 'unchecked',
  }
}

// ── 3. HubPayload 消费矩阵 ──
{
  const hubSrc = read('app/api/profile/hub/route.ts')
  const hubFields = [...hubSrc.matchAll(/^\s{4}(\w+)[,:]?/gm)]
    .map((m) => m[1])
    .filter((f) =>
      [
        'coreJudgment',
        'completeness',
        'supportFocus',
        'behaviorSummary',
        'interactionPattern',
        'effectiveStrategies',
        'pendingHypotheses',
        'pendingHypothesesList',
        'structuralTensions',
        'hasRealData',
        'thinkingChips',
        'portraitCards',
        'highlights',
        'highlightMoments',
        'refreshedAt',
        'presentationWatermark',
      ].includes(f)
    )
  const mpSrc = read('miniprogram/src/pages/profile/index.tsx')
  const applyBlock = mpSrc.slice(mpSrc.indexOf('const applyHubData'), mpSrc.indexOf('const applyHandbookPack'))
  const consumed = []
  const declaredNotConsumed = []
  for (const f of hubFields) {
    if (applyBlock.includes(`data.${f}`) || applyBlock.includes(`wm?.`)) consumed.push(f)
    else declaredNotConsumed.push(f)
  }
  // partial: presentationWatermark only partially used
  report.sections.hubPayloadMatrix = {
    hubProduces: hubFields,
    mpApplyHubDataConsumes: consumed,
    declaredInTypeButNotApplyHubData: declaredNotConsumed.filter(
      (f) => mpSrc.includes(`${f}?:`) || mpSrc.includes(`${f}:`)
    ),
    partialConsumption: ['presentationWatermark.uiStale', 'presentationWatermark.digestStale', 'presentationWatermark.buildRunStatus', 'pendingHypothesesList', 'highlights', 'structuralTensions'],
    file: 'miniprogram/src/pages/profile/index.tsx:applyHubData',
  }
}

// ── 4. Dead write / reader 矩阵 ──
{
  const layers = [
    {
      layer: 'deep_mechanism_handoffs',
      writer: 'src/lib/server/memory/deep-mechanism/handoff-store.ts',
      readers: grepFiles(['audit-deep-modeling-pipeline.mjs'], 'deep_mechanism_handoffs'),
      verdict: 'audit_only',
    },
    {
      layer: 'handbook_admit_candidates',
      writer: 'src/lib/server/profile/handbook-candidates-store.ts',
      readers: grepFiles(['handbook-admission.ts', 'handbook-enriched-candidate.ts'], 'handbook'),
      verdict: 'has_reader',
    },
    {
      layer: 'raw_materials / cleaned_facts / retrieval_indexes',
      writer: 'executeWritePlan (gated)',
      readers: grepFiles(['retrieval/router.ts'], 'raw_materials'),
      verdict: 'dead_layer_gated',
    },
  ]
  report.sections.deadWriteMatrix = layers
}

function grepFiles(files, needle) {
  const hits = []
  for (const f of files) {
    try {
      if (read(`src/lib/server/profile/${f}`).includes(needle) || read(`scripts/${f}`).includes(needle)) {
        hits.push(f)
      }
    } catch {
      try {
        if (read(f).includes(needle)) hits.push(f)
      } catch {
        /* skip */
      }
    }
  }
  return hits
}

// ── 5. SP dossier v3 五段覆盖 ──
{
  const spFiles = [
    'prompts/front/dailyDialogueOrchestration.md',
    'prompts/front/dailyPortraitRefresh.md',
    'prompts/front/communicationRehearsal.md',
    'prompts/core/deepModelingParentDigest.md',
  ]
  const segments = ['integratedSynthesis', 'workingHypothesis', 'sceneReadings', 'interventionTargets', 'familyStruct']
  const spCoverage = {}
  for (const f of spFiles) {
    const content = read(f)
    spCoverage[f] = {
      mentionsDossierSlice: content.includes('dossierSlice'),
      v3Segments: segments.filter((s) => content.includes(s)),
    }
  }
  report.sections.spDossierCoverage = spCoverage
}

// ── 6. 18 断点 delta 快照 ──
report.sections.breakpointDelta = [
  { id: 1, name: 'hidden payload 丢 retrievalPack', status: 'open', file: 'parent-facing-copy.ts:106' },
  { id: 2, name: '预演 handoff 空', status: 'partial', file: 'DailyAiMessage.tsx:148', note: 'daily/index 未写；无 retrievalPackDigest' },
  { id: 3, name: '预演 end hardcode', status: 'fixed', file: 'rehearsal/index.tsx:795', note: 'getRehearsalEndCopy(endData)' },
  { id: 4, name: '建档 Hero hardcode', status: 'open', file: 'result/index.tsx:132' },
  { id: 5, name: 'enrich tensions 学术 title', status: 'open', file: 'portrait-card-enrich.ts:87' },
  { id: 6, name: 'fillDailySectionCopy taskTitle 孤儿', status: 'open', file: 'daily-turn-bff.ts' },
  { id: 7, name: 'enrich 静态空话', status: 'open', file: 'portrait-card-enrich.ts:166' },
  { id: 8, name: '主1/次2 禁止词未同步', status: 'open', file: 'parentFacingStyle.md' },
  { id: 9, name: 'daily/rehearsal SP 未按 v3 五段', status: 'open', file: 'dailyDialogueOrchestration.md' },
  { id: 10, name: 'dailyPortraitRefresh 未显式 parentFacingStyle', status: 'partial', file: 'registry 拼装层可能补' },
  { id: 11, name: 'HubPayload 未消费字段', status: 'open', file: 'profile/index.tsx' },
  { id: 12, name: 'deep/evidence/verify 读不全', status: 'open', file: 'profile/deep|evidence|verify' },
  { id: 13, name: 'daily thinkingChips fallback 通用', status: 'open', file: 'daily/index.tsx' },
  { id: 14, name: 'daily 不回传 retrievedContextSnapshot', status: 'open', file: 'dailyStream.ts' },
  { id: 15, name: 'THEORY_CARDS 文档 15×9', status: 'open', file: 'theory-cards.ts' },
  { id: 16, name: 'profileChipPanels 残留', status: 'obsolete', note: '2026-07-14 已删' },
  { id: 17, name: 'deep_mechanism_handoffs dead write', status: 'partial', note: '仅 audit 读，非前台' },
  { id: 18, name: 'saveEnrichedHandbookCandidate dead write', status: 'obsolete', note: '→ handbook_admit_candidates 有 reader' },
]

// ── 7. 读包填充率（需 DATABASE_URL，直查 DB 避免 ts 路径）──
if (process.env.DATABASE_URL) {
  try {
    const pg = (await import('pg')).default
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const PACK_KEYS = [
      'childStructureModels',
      'entryEvidence',
      'entryFacts',
      'dossierSlice',
      'matchedMechanisms',
      'familyPatterns',
      'parentUnderstanding',
      'recentEvents',
      'pendingHypotheses',
      'childQuotes',
      'parentVerbatimSnippets',
    ]
    const turnRes = await pool.query(
      `SELECT data FROM memory_layer_items
       WHERE family_id=$1 AND child_id=$2 AND layer_name='turn_events'
       ORDER BY updated_at DESC LIMIT 1`,
      [familyId, childId]
    )
    const snap = turnRes.rows[0]?.data?.retrievedContextSnapshot
    const keyMap = {
      childStructureModels: 'relevantChildStructureModel',
      entryEvidence: 'relevantEntryEvidencePacks',
      entryFacts: 'entryFacts',
      dossierSlice: 'dossierSlice',
      matchedMechanisms: 'matchedMechanisms',
      familyPatterns: 'relevantFamilyInteractionPatterns',
      parentUnderstanding: 'parentNarrativePattern',
      recentEvents: 'relevantPastEvents',
      pendingHypotheses: 'relevantPendingHypotheses',
      childQuotes: 'childQuotes',
      parentVerbatimSnippets: 'parentVerbatimSnippets',
    }
    if (snap) {
      const fill = {}
      let nonEmpty = 0
      for (const k of PACK_KEYS) {
        const arr = snap[keyMap[k]]
        fill[k] = Array.isArray(arr) ? arr.length : 0
        if (fill[k] > 0) nonEmpty++
      }
      report.sections.readPackFillRate = {
        source: 'latest turn_events.retrievedContextSnapshot',
        nonEmptyKeys: nonEmpty,
        totalKeys: PACK_KEYS.length,
        fill,
      }
    } else {
      report.sections.readPackFillRate = { error: 'no retrievedContextSnapshot on latest turn' }
    }
    const digestRes = await pool.query(
      `SELECT data FROM memory_layer_items
       WHERE family_id=$1 AND child_id=$2 AND layer_name='deep_model_digest' AND item_id='latest'`,
      [familyId, childId]
    )
    const digest = digestRes.rows[0]?.data
    if (digest) {
      report.sections.deepModelDigestStats = {
        mechanismNarrativeLen: String(digest.mechanismNarrative || '').length,
        anchoredFactsN: Array.isArray(digest.anchoredFacts) ? digest.anchoredFacts.length : 0,
        hasDossier: Boolean(digest.dossier && JSON.stringify(digest.dossier) !== 'null'),
        structuralTensionsN: Array.isArray(digest.structuralTensions) ? digest.structuralTensions.length : 0,
      }
    }
    await pool.end()
  } catch (e) {
    report.sections.readPackFillRate = { error: String(e.message || e) }
  }
} else {
  report.sections.readPackFillRate = { skipped: 'DATABASE_URL not set — run on server for fill rate' }
}

// ── 8. 工具链缺口 ──
report.sections.toolchainGaps = [
  { gap: 'npm run audit:fullchain 未在 package.json 定义', workaround: 'npm run test:contracts && node scripts/audit-prompt-registry.mjs' },
  { gap: '无 prose 原话锚定自动 scorer', workaround: 'replay-daily-prose.mjs + 人工抽检' },
]

// output
const outDir = join(root, '.trae/documents')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'memory-utilization-audit-json-20260721.json')
writeFileSync(outPath, JSON.stringify(report, null, 2))

if (asJson) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('=== 记忆利用率审计 JSON ===')
  console.log('written:', outPath)
  console.log('\n--- hidden payload ---')
  console.log(JSON.stringify(report.sections.hiddenPayloadDiff, null, 2))
  console.log('\n--- contract drift (sample) ---')
  console.log(JSON.stringify(report.sections.contractDrift.drift.slice(0, 5), null, 2))
  console.log('\n--- hub matrix undeclared ---')
  console.log(JSON.stringify(report.sections.hubPayloadMatrix.declaredInTypeButNotApplyHubData, null, 2))
  console.log('\n--- SP dossier v3 segments ---')
  for (const [f, v] of Object.entries(report.sections.spDossierCoverage)) {
    console.log(`  ${f}: v3=[${v.v3Segments.join(',')}] dossierSlice=${v.mentionsDossierSlice}`)
  }
  console.log('\n--- breakpoint summary ---')
  const counts = { open: 0, partial: 0, fixed: 0, obsolete: 0 }
  for (const b of report.sections.breakpointDelta) counts[b.status] = (counts[b.status] || 0) + 1
  console.log(counts)
}

process.exit(0)
