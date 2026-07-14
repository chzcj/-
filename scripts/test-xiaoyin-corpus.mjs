#!/usr/bin/env node
/**
 * 按 manifest 顺序跑小尹妈妈语料全链路，记录每条输入的 AI 输出与耗时。
 *
 * 用法:
 *   node scripts/test-xiaoyin-corpus.mjs
 *   TEST_BASE_URL=https://yujian.yihe.site node scripts/test-xiaoyin-corpus.mjs
 *   CORPUS_PHASE=build,daily CORPUS_LIMIT=2 node scripts/test-xiaoyin-corpus.mjs
 *
 * 环境变量:
 *   TEST_BASE_URL     默认 https://yujian.yihe.site
 *   CORPUS_DIR        默认 scripts/xiaoyin-mom-corpus
 *   CORPUS_OUT        报告 JSON 路径（默认 scripts/test-reports/xiaoyin-corpus-<ts>.json）
 *   CORPUS_PHASE      hifi（默认）| legacy | all | build,synthesis,daily,rehearsal,profile,...
 *                     hifi = 高保真主应用四 Tab + 首次建模
 *                     legacy = 旧 ChildOS 专项（edu/planner/multiview/weekly/snapshot 种子）
 *   CORPUS_LIMIT      每个 phase 最多跑几条（0=不限）
 *   CORPUS_DELAY_MS   两次 LLM 调用间隔，默认 300
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site'
const ORIGIN = new URL(BASE).origin
const CORPUS_DIR = path.resolve(ROOT, process.env.CORPUS_DIR || 'scripts/xiaoyin-mom-corpus')
const DELAY_MS = Number(process.env.CORPUS_DELAY_MS || 300)
const LIMIT = Number(process.env.CORPUS_LIMIT || 0)

/** 对齐 BottomNavTabs：交流 / 任务 / 预演 / 画像 + 首次建模 */
const HIFI_PHASES = ['build', 'synthesis', 'daily', 'rehearsal', 'profile']
/** 旧 ChildOS 独立专项，代码仍在但不在高保真主导航 */
const LEGACY_PHASES = ['edu', 'planner', 'multiview', 'weekly', 'snapshot']

function resolvePhases() {
  const raw = (process.env.CORPUS_PHASE || 'hifi').trim()
  if (raw === 'hifi') return HIFI_PHASES
  if (raw === 'legacy') return LEGACY_PHASES
  if (raw === 'all') return [...HIFI_PHASES, ...LEGACY_PHASES]
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

const PHASES = resolvePhases()

const REPORT_PATH =
  process.env.CORPUS_OUT ||
  path.join(ROOT, 'scripts/test-reports', `xiaoyin-corpus-${Date.now()}.json`)

let cookieJar = ''
const entryMap = {}
const report = {
  meta: {
    base: BASE,
    corpusDir: CORPUS_DIR,
    phases: PHASES,
    productSurface: 'hifi',
    limit: LIMIT || null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  },
  summary: { total: 0, ok: 0, fail: 0, skip: 0 },
  steps: [],
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(CORPUS_DIR, name), 'utf8'))
}

function preview(text, max = 160) {
  if (!text) return ''
  const s = typeof text === 'string' ? text : JSON.stringify(text)
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function extractOutput(api, json, stream) {
  if (!json?.ok) return { error: json?.error || json }
  const d = json.data ?? json
  switch (api) {
    case '/api/entry/analyze:entry':
      return {
        shouldAsk: d.shouldAsk,
        purpose: d.purpose,
        voicePrompt: d.voicePrompt,
        directions: d.directions,
      }
    case '/api/entry/analyze:summary':
      return {
        mainJudgment: d.mainJudgment,
        facts: d.facts,
        pendingHypotheses: d.pendingHypotheses,
      }
    case '/api/synthesis':
      return {
        mechanismCount: d.synthesis?.candidateMechanismMatrix?.length ?? 0,
        crossEntryCount: d.synthesis?.crossEntryObservations?.length ?? 0,
        maturity: d.synthesis?.contextMaturityLevel,
      }
    case '/api/diagnosis':
      return {
        profileCount: d.diagnosis?.secondMeConditionalProfile?.length ?? 0,
        verifyCount: d.diagnosis?.needsFurtherVerification?.length ?? 0,
      }
    case '/api/daily/stream':
      return {
        traceId: d.traceId,
        visibleReply: d.visibleReply || stream?.text,
        proseLen: (d.visibleReply || stream?.text || '').length,
        sectionIds: (stream?.sections || d.sections || []).map((s) => s.id),
        sectionLabels: (stream?.sections || d.sections || []).map((s) => s.label),
        actionLabels: (stream?.actions || d.actions || []).map((a) => a.label),
        linkedAreas: d.linkedAreas || stream?.linkedAreas,
        hasThinking: Boolean(stream?.thinkingChips?.length),
      }
    case '/api/rehearsal/analyze':
      return {
        uiMode: d.uiMode,
        acknowledgement: d.acknowledgement,
        collectionGuide: d.collectionGuide,
        childLikelyHearing: d.result?.childLikelyHearing || d.childLikelyHearing,
        saferVersion: d.result?.saferVersion || d.saferVersion,
      }
    case '/api/education-diagnosis':
      return {
        uiMode: d.uiMode,
        acknowledgement: d.acknowledgement,
        followupPrompt: d.followupPrompt,
        modeReading: d.result?.modeReading,
        keyTensions: d.result?.keyTensions,
      }
    case '/api/family-planner':
      return {
        uiMode: d.uiMode,
        enoughToPlan: d.enoughToPlan,
        boundaryFirst: d.boundaryFirst,
        actions: d.actions,
        missingInfo: d.missingInfo,
      }
    case '/api/multi-view':
      return {
        headline: d.headline,
        parentView: d.parentView,
        childView: d.childView,
        teacherView: d.teacherView,
      }
    case '/api/profile/weekly-review':
      return d
    case '/api/profile/built:post':
    case '/api/profile/built:get':
      return d
    case '/api/account/daily-refresh': {
      const snap = d.snapshot || d
      return {
        source: snap.source,
        refreshedAt: snap.refreshedAt,
        portraitCardKeys: snap.portraitCards ? Object.keys(snap.portraitCards) : [],
        highlightsCount: snap.highlights?.length ?? 0,
      }
    }
    case '/api/profile/hub':
      return {
        completeness: d.completeness,
        refreshedAt: d.refreshedAt,
        portraitCardKeys: d.portraitCards ? Object.keys(d.portraitCards) : [],
        highlightsCount: d.highlights?.length ?? 0,
      }
    case '/api/profile/card':
      return {
        summaryLen: (d.summary || '').length,
        leadLen: (d.lead || '').length,
        sectionCount: d.sections?.length ?? 0,
        factCount: d.anchoredFacts?.length ?? 0,
      }
    case '/api/profile/readiness':
      return d
    default:
      return d
  }
}

function saveReport() {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
}

function recordStep(step) {
  report.steps.push(step)
  report.summary.total += 1
  if (step.ok) report.summary.ok += 1
  else if (step.skipped) report.summary.skip += 1
  else report.summary.fail += 1
  saveReport()
}

function phaseEnabled(name) {
  return PHASES.includes(name)
}

async function request(pathname, body, { method = 'POST' } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`,
  }
  if (cookieJar) headers.Cookie = cookieJar
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const rawSetCookie = res.headers.get('set-cookie')
  const cookieParts = setCookie.length ? setCookie : rawSetCookie ? [rawSetCookie] : []
  for (const c of cookieParts) {
    const part = c.split(';')[0]
    if (part.startsWith('childos_session=')) cookieJar = part
  }
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function streamDaily(text) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`,
  }
  if (cookieJar) headers.Cookie = cookieJar
  const started = Date.now()
  const res = await fetch(`${BASE}/api/daily/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    return {
      status: res.status,
      latencyMs: Date.now() - started,
      json,
      stream: null,
    }
  }
  const decoder = new TextDecoder()
  const reader = res.body.getReader()
  let buffer = ''
  let traceId = null
  let final = null
  let visibleReply = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const ev = JSON.parse(line)
        if (ev.type === 'start') traceId = ev.traceId
        if (ev.type === 'delta' && ev.delta) visibleReply += ev.delta
        if (ev.type === 'final') final = ev
      } catch {
        /* ignore partial */
      }
    }
  }
  return {
    status: res.status,
    latencyMs: Date.now() - started,
    json: {
      ok: true,
      data: {
        traceId,
        visibleReply: final?.text || visibleReply,
        linkedAreas: final?.linkedAreas,
        cards: final?.cards,
        sections: final?.sections,
        actions: final?.actions,
      },
    },
    stream: final,
  }
}

async function timedCall(phase, caseId, api, fn, inputMeta = {}) {
  if (DELAY_MS > 0) await sleep(DELAY_MS)
  const started = Date.now()
  try {
    const { status, json, stream } = await fn()
    const latencyMs = Date.now() - started
    const ok = json?.ok === true || (api === '/api/daily/stream' && status === 200 && json?.ok)
    const output = extractOutput(api, json, stream)
    const step = {
      phase,
      caseId,
      api,
      ok,
      status,
      latencyMs,
      input: inputMeta,
      outputPreview: preview(
        output.visibleReply ||
          output.purpose ||
          output.mainJudgment ||
          output.headline ||
          output.acknowledgement ||
          output,
      ),
      output,
      traceId: output.traceId || json?.data?.traceId,
      error: ok ? undefined : json?.error || json,
      at: new Date().toISOString(),
    }
    recordStep(step)
    console.log(
      `${ok ? '✓' : '✗'} [${phase}] ${caseId} ${api} ${latencyMs}ms ${step.outputPreview.slice(0, 72)}`,
    )
    return { ok, json, latencyMs, output }
  } catch (error) {
    const latencyMs = Date.now() - started
    const step = {
      phase,
      caseId,
      api,
      ok: false,
      latencyMs,
      input: inputMeta,
      error: String(error),
      at: new Date().toISOString(),
    }
    recordStep(step)
    console.log(`✗ [${phase}] ${caseId} ${api} ${latencyMs}ms FATAL ${error}`)
    return { ok: false, error }
  }
}

async function demoLogin() {
  return timedCall('auth', 'demo_login', '/api/auth/demo', () => request('/api/auth/demo', {}))
}

async function realLogin() {
  const phone = process.env.TEST_PHONE
  const password = process.env.TEST_PASSWORD
  if (!phone || !password) return { ok: false }
  return timedCall('auth', 'real_login', '/api/auth/login', () =>
    request('/api/auth/login', { phone, password }),
  )
}

async function ensureLogin() {
  const demo = await demoLogin()
  if (demo.ok) return demo
  const real = await realLogin()
  if (real.ok) return real
  return demo
}

async function runProfileBuild() {
  const data = loadJson('01_profile_build_inputs.json')
  for (const mod of data.modules) {
    const { entryType, rounds } = mod
    if (!entryMap[entryType]) {
      entryMap[entryType] = { rawTexts: [], followUps: [], stageSummary: '', aiFacts: [], aiHypotheses: [] }
    }
    let combined = ''
    let roundLimit = LIMIT > 0 ? LIMIT : rounds.length
    for (let i = 0; i < Math.min(rounds.length, roundLimit); i++) {
      const round = rounds[i]
      combined = combined ? `${combined}\n\n${round.parentText}` : round.parentText
      const res = await timedCall(
        'build',
        round.caseId,
        '/api/entry/analyze:entry',
        () => request('/api/entry/analyze', { entryType, rawText: combined, stage: 'entry' }),
        { entryType, roundIndex: round.roundIndex, chars: combined.length, textPreview: preview(round.parentText, 80) },
      )
      if (i === 0) entryMap[entryType].rawTexts.push(round.parentText)
      else entryMap[entryType].followUps.push(round.parentText)
      if (res.ok && res.output?.shouldAsk === false && i < rounds.length - 1) {
        // 产品会跳 summary；语料测试继续累加后续轮次
        recordStep({
          phase: 'build',
          caseId: `${round.caseId}__note`,
          api: 'note',
          ok: true,
          skipped: false,
          latencyMs: 0,
          input: { note: 'shouldAsk=false 但语料仍有后续轮次，继续累加' },
          at: new Date().toISOString(),
        })
      }
    }

    const summaryRes = await timedCall(
      'build',
      `${entryType}_summary`,
      '/api/entry/analyze:summary',
      () => request('/api/entry/analyze', { entryType, rawText: combined, stage: 'summary' }),
      { entryType, chars: combined.length },
    )
    if (summaryRes.ok) {
      entryMap[entryType].stageSummary = summaryRes.output.mainJudgment || ''
      entryMap[entryType].aiFacts = summaryRes.output.facts || []
      entryMap[entryType].aiHypotheses = summaryRes.output.pendingHypotheses || []
    }
  }

  const finalText = data.finalFollowUp.parentText
  await timedCall(
    'build',
    data.finalFollowUp.caseId,
    '/api/entry/analyze:entry',
    () => request('/api/entry/analyze', { entryType: 'final', rawText: finalText, stage: 'entry' }),
    { entryType: 'final', chars: finalText.length },
  )
  report.meta.finalFollowUpText = finalText
}

async function runSynthesisChain() {
  const crossCuttingSupplement = report.meta.finalFollowUpText || ''
  const completed = Object.values(entryMap).filter((v) => v.rawTexts.length > 0).length
  const synthesisRes = await timedCall(
    'synthesis',
    'synthesis_all_modules',
    '/api/synthesis',
    () =>
      request('/api/synthesis', {
        entryMap,
        crossCuttingSupplement,
        maturityLevel: completed >= 4 ? 'L2' : 'L1',
      }),
    { moduleCount: completed, crossCuttingChars: crossCuttingSupplement.length },
  )

  let synthesisOutput = synthesisRes.json?.data?.synthesis
  await timedCall(
    'synthesis',
    'diagnosis_initial',
    '/api/diagnosis',
    () =>
      request('/api/diagnosis', {
        taskType: 'initial_model',
        synthesisOutput,
        maturityLevel: 'L2',
      }),
    {},
  )

  await timedCall(
    'synthesis',
    'profile_readiness',
    '/api/profile/readiness',
    () => request('/api/profile/readiness', undefined, { method: 'GET' }),
    {},
  )
}

async function runDailyDialogue() {
  const data = loadJson('02_daily_dialogue_cases.json')
  const cases = LIMIT > 0 ? data.cases.slice(0, LIMIT) : data.cases
  for (const c of cases) {
    await timedCall(
      'daily',
      c.caseId,
      '/api/daily/stream',
      () => streamDaily(c.parentText),
      { chars: c.parentText.length, dailyType: c.dailyType, textPreview: preview(c.parentText, 80) },
    )
  }
}

async function runRehearsal() {
  const data = loadJson('03_rehearsal_cases.json')
  const cases = LIMIT > 0 ? data.cases.slice(0, LIMIT) : data.cases
  for (const c of cases) {
    const parentText = c.parentOriginalWords || c.parentText || ''
    await timedCall(
      'rehearsal',
      c.caseId,
      '/api/rehearsal/analyze',
      () =>
        request('/api/rehearsal/analyze', {
          parentText,
          fromSpecialFeature: true,
          rehearsalContext: {
            parentGoal: c.parentGoal,
            parentWorry: c.parentWorry,
            whatHappenedBeforeTalk: c.background || c.previousSimilarOutcome,
          },
        }),
      { chars: parentText.length, hasWords: Boolean(parentText.trim()) },
    )
  }
}

async function runEducationDiagnosis() {
  const data = loadJson('04_education_diagnosis_cases.json')
  const samples = LIMIT > 0 ? data.samples.slice(0, LIMIT) : data.samples
  for (const sample of samples) {
    const priorTurns = []
    const rounds = LIMIT > 0 ? sample.rounds.slice(0, LIMIT) : sample.rounds
    for (const round of rounds) {
      await timedCall(
        'edu',
        round.caseId,
        '/api/education-diagnosis',
        () => request('/api/education-diagnosis', { text: round.parentText, priorTurns: [...priorTurns] }),
        { sampleId: sample.sampleId, chars: round.parentText.length },
      )
      priorTurns.push(round.parentText)
    }
  }
}

async function runFamilyPlanner() {
  const data = loadJson('05_family_planner_cases.json')
  const cases = LIMIT > 0 ? data.cases.slice(0, LIMIT) : data.cases
  for (const c of cases) {
    await timedCall(
      'planner',
      c.caseId,
      '/api/family-planner',
      () => request('/api/family-planner', { text: c.parentText }),
      { chars: c.parentText.length },
    )
  }
}

async function runMultiView() {
  const data = loadJson('06_multi_view_child_voice_cases.json')
  const cases = LIMIT > 0 ? data.cases.slice(0, LIMIT) : data.cases
  for (const c of cases) {
    const childText = c.childOriginalWords || c.childText || ''
    await timedCall(
      'multiview',
      c.caseId,
      '/api/multi-view',
      () => request('/api/multi-view', { childText }),
      { chars: childText.length, hasTeacherInfo: Boolean(c.teacherOrSchoolInfo) },
    )
  }
}

async function runWeeklyReview() {
  const data = loadJson('07_weekly_review_observations.json')
  const weeks = LIMIT > 0 ? data.weeks.slice(0, LIMIT) : data.weeks
  for (const w of weeks) {
    await timedCall(
      'weekly',
      w.caseId,
      '/api/profile/weekly-review',
      () => request('/api/profile/weekly-review', { observations: w.observations }),
      { observationCount: w.observations.length },
    )
  }
}

function toBuiltSnapshotFromSeed(seed) {
  const p = seed.profileSnapshot || seed
  const evidenceRaw = p.evidence || []
  const verifyRaw = p.verificationPoints || []
  const completeness =
    typeof p.completeness === 'number'
      ? p.completeness
      : typeof p.completeness === 'object' && p.completeness
        ? Math.round(
            (Object.values(p.completeness).reduce((a, b) => a + Number(b || 0), 0) /
              Math.max(1, Object.keys(p.completeness).length)) *
              100,
          )
        : 65
  return {
    coreJudgment: p.coreJudgment || '',
    deepMechanism:
      (p.familyCycles || []).join('\n') ||
      '家长常见动作：加码检查与任务；孩子接收成：写完也不会结束；孩子保护策略：拖延敷衍。',
    supportFocus: (p.nextBestQuestions || [])[0] || '先看清「做完一项后家里会不会再加任务」。',
    completeness,
    evidence: evidenceRaw.map((t) =>
      typeof t === 'string'
        ? { sourceLabel: '建模记录', evidenceText: t, strength: 'medium' }
        : t,
    ),
    verificationPoints: verifyRaw.map((t) =>
      typeof t === 'string'
        ? { title: t.slice(0, 36), description: t }
        : t,
    ),
  }
}

async function seedBuiltFromXiaoyinV1() {
  const data = loadJson('08_profile_snapshot_seed.json')
  const v1 = data.snapshots?.find((s) => s.caseId === 'profile_v1') || data.snapshots?.[0]
  if (!v1) return { ok: false, skipped: true }
  const snapshot = toBuiltSnapshotFromSeed(v1)
  return timedCall('profile', 'seed_built_v1', '/api/profile/built:post', () =>
    request('/api/profile/built', { snapshot }),
  )
}

/** 画像 Tab：种子 built → daily-refresh → hub portraitCards → 卡片详情 */
async function runProfileTab() {
  await seedBuiltFromXiaoyinV1()

  await timedCall(
    'profile',
    'daily_refresh',
    '/api/account/daily-refresh',
    () => request('/api/account/daily-refresh', {}, { method: 'POST' }),
    { route: '/pages/profile/index useDidShow' },
  )

  await timedCall(
    'profile',
    'profile_hub_chip_panels',
    '/api/profile/hub',
    () => request('/api/profile/hub', undefined, { method: 'GET' }),
    { route: '/pages/profile/index' },
  )

  await timedCall(
    'profile',
    'profile_card_focus',
    '/api/profile/card',
    () => request('/api/profile/card/focus', undefined, { method: 'GET' }),
    { route: '/pages/profile/card?id=focus' },
  )

  await timedCall(
    'profile',
    'family_profile_built_get',
    '/api/profile/built:get',
    () => request('/api/profile/built', undefined, { method: 'GET' }),
    { route: '/packageOnboarding/pages/result' },
  )
}

async function runSnapshotSeed() {
  const data = loadJson('08_profile_snapshot_seed.json')
  for (const snap of data.snapshots) {
    const snapshot = snap.profileSnapshot
    await timedCall(
      'snapshot',
      `${snap.caseId}_post`,
      '/api/profile/built:post',
      () => request('/api/profile/built', { snapshot }),
      { version: snap.version },
    )
    await timedCall(
      'snapshot',
      `${snap.caseId}_get`,
      '/api/profile/built:get',
      () => request('/api/profile/built', undefined, { method: 'GET' }),
      { version: snap.version },
    )
  }
}

async function main() {
  console.log('========================================')
  console.log('小尹妈妈语料 · 高保真主应用测试')
  console.log(`目标: ${BASE}`)
  console.log(`语料: ${CORPUS_DIR}`)
  console.log(`报告: ${REPORT_PATH}`)
  console.log(`阶段: ${PHASES.join(', ')}  LIMIT=${LIMIT || '∞'}`)
  console.log('========================================')

  saveReport()

  const readiness = await request('/api/readiness', undefined, { method: 'GET' })
  if (!readiness.json?.ok) {
    console.error('服务未就绪', readiness)
    process.exit(2)
  }

  const login = await ensureLogin()
  if (!login.ok) process.exit(2)

  if (phaseEnabled('build')) await runProfileBuild()
  if (phaseEnabled('synthesis')) await runSynthesisChain()
  if (phaseEnabled('daily')) await runDailyDialogue()
  if (phaseEnabled('rehearsal')) await runRehearsal()
  if (phaseEnabled('profile')) await runProfileTab()
  if (phaseEnabled('edu')) await runEducationDiagnosis()
  if (phaseEnabled('planner')) await runFamilyPlanner()
  if (phaseEnabled('multiview')) await runMultiView()
  if (phaseEnabled('weekly')) await runWeeklyReview()
  if (phaseEnabled('snapshot')) await runSnapshotSeed()

  report.meta.finishedAt = new Date().toISOString()
  saveReport()

  console.log('\n========================================')
  console.log(`完成: ${report.summary.ok}/${report.summary.total} 成功, ${report.summary.fail} 失败`)
  console.log(`报告: ${REPORT_PATH}`)
  console.log('========================================')
  process.exit(report.summary.fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('FATAL', e)
  report.meta.finishedAt = new Date().toISOString()
  report.meta.fatal = String(e)
  saveReport()
  process.exit(2)
})
