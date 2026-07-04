#!/usr/bin/env node
/**
 * 将 zip 版五入口小尹妈妈语料适配为当前四模块 ChildOS 结构。
 * 输入：scripts/corpus-import/*.json
 * 输出：scripts/xiaoyin-mom-corpus/*.json + manifest.json
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const IMPORT_DIR = path.join(ROOT, 'scripts/corpus-import')
const OUT_DIR = path.join(ROOT, 'scripts/xiaoyin-mom-corpus')

const LEGACY_TO_BUILD = {
  daily_phone_rhythm: 'daily',
  learning_homework: 'homework',
  parent_child_communication: 'communication',
  emotion_pressure: 'communication',
  family_environment: 'family',
}

const BUILD_ORDER = ['daily', 'homework', 'communication', 'family']

const BUILD_META = {
  daily: {
    title: '孩子平时怎么过',
    route: '/profile/build/daily',
    apiEntryType: 'daily',
    legacyEntryId: 'daily_phone_rhythm',
  },
  homework: {
    title: '学习和作业怎么进行',
    route: '/profile/build/homework',
    apiEntryType: 'homework',
    legacyEntryId: 'learning_homework',
  },
  communication: {
    title: '你们通常怎么沟通',
    route: '/profile/build/communication',
    apiEntryType: 'communication',
    legacyEntryIds: ['parent_child_communication', 'emotion_pressure'],
  },
  family: {
    title: '家里怎么一起支持他',
    route: '/profile/build/family',
    apiEntryType: 'family',
    legacyEntryId: 'family_environment',
  },
}

const COMPLETENESS_KEY_MAP = {
  learning_homework: 'homework',
  daily_phone_rhythm: 'daily',
  parent_child_communication: 'communication',
  emotion_pressure: 'communication_emotion',
  family_environment: 'family',
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(IMPORT_DIR, name), 'utf8'))
}

function writeJson(name, data) {
  fs.writeFileSync(path.join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function normalizeParentText(text) {
  if (typeof text !== 'string') return text
  return text
    .replace(/初三/g, '初二')
    .replace(/中考/g, '升学')
}

function patchCase(caseItem, patches) {
  const next = { ...caseItem, ...patches }
  if (typeof next.parentText === 'string') next.parentText = normalizeParentText(next.parentText)
  if (typeof next.parentOriginalWords === 'string') {
    next.parentOriginalWords = normalizeParentText(next.parentOriginalWords)
  }
  if (typeof next.childOriginalWords === 'string') {
    next.childOriginalWords = normalizeParentText(next.childOriginalWords)
  }
  if (Array.isArray(next.observations)) {
    next.observations = next.observations.map((o) => normalizeParentText(o))
  }
  return next
}

function adaptProfileBuildInputs(raw) {
  const byLegacy = Object.fromEntries(raw.entries.map((e) => [e.entryId, e]))

  const modules = BUILD_ORDER.map((entryType) => {
    const meta = BUILD_META[entryType]
    const legacyIds =
      entryType === 'communication'
        ? meta.legacyEntryIds
        : [meta.legacyEntryId]

    const rounds = []
    for (const legacyId of legacyIds) {
      const entry = byLegacy[legacyId]
      if (!entry) continue
      for (const [index, round] of entry.rounds.entries()) {
        const roundIndex = rounds.length + 1
        const stage = roundIndex === 1 ? 'entry' : 'followup'
        rounds.push(
          patchCase(round, {
            entryType,
            legacyEntryId: legacyId,
            legacyEntryName: entry.entryName,
            roundIndex,
            stage,
            targetFeature: 'profile_build_entry',
            route: meta.route,
            followUpRoute: `${meta.route}/follow-up`,
            summaryRoute: `${meta.route}/summary`,
            api: {
              method: 'POST',
              path: '/api/entry/analyze',
              body: {
                entryType,
                stage: stage === 'entry' ? 'entry' : 'entry',
                entryText: '<parentText>',
                priorContext: stage === 'followup' ? '<prior rounds combined>' : undefined,
              },
              summary: {
                stage: 'summary',
                entryText: '<all rounds combined>',
              },
            },
          }),
        )
      }
    }

    return {
      entryType,
      title: meta.title,
      route: meta.route,
      roundCount: rounds.length,
      rounds,
    }
  })

  const finalFollowUp = {
    caseId: 'final_followup_001',
    targetFeature: 'profile_build_final',
    route: '/profile/build/final-follow-up',
    api: {
      method: 'POST',
      path: '/api/entry/analyze',
      body: { entryType: 'final', stage: 'entry', entryText: '<parentText>' },
    },
    parentText: normalizeParentText(
      '如果只能再补一个最关键的，我想说是「检查」这件事。我一检查他就烦，觉得不信任他；我不检查他就糊弄，作业看着写了其实没写完。我试过只问进度不翻本子，他还是拖。我也试过约定时间不管过程，到点还是没完成。我不是想当警察，是真的不知道还能怎么管。你们要是能给一个我能做得到的办法就好了，别让我再天天坐到半夜。',
    ),
    hiddenGroundTruth: {
      facts: ['检查引发冲突', '不检查会糊弄', '家长尝试过多种边界'],
      shouldAskFollowup: true,
    },
  }

  return {
    datasetName: '01_profile_build_inputs',
    description:
      '四模块首次建模语料（由五入口 zip 适配）：daily→homework→communication(含原情绪压力)→family；每模块多轮自然输入，供 entry/analyze + summary + final + synthesis 链路测试。',
    schemaVersion: '2026-06-12',
    persona: {
      parentName: '小尹妈妈',
      childNickname: '小尹',
      childAge: '14',
      childGrade: '初二',
    },
    buildOrder: BUILD_ORDER,
    legacyMapping: LEGACY_TO_BUILD,
    modules,
    finalFollowUp,
    synthesisHint: {
      api: { method: 'POST', path: '/api/synthesis' },
      route: '/profile/generating',
      crossCuttingSupplementSource: 'finalFollowUp.parentText',
    },
  }
}

function adaptDailyDialogue(raw) {
  return {
    ...raw,
    datasetName: '02_daily_dialogue_cases',
    description: `${raw.description} 已适配当前 /daily 主入口与 /api/daily/stream。`,
    schemaVersion: '2026-06-12',
    targetRoute: '/daily',
    targetApi: '/api/daily/stream',
    cases: raw.cases.map((c, i) =>
      patchCase(c, {
        dayIndex: Math.floor(i / 3) + 1,
        targetFeature: 'daily_stream',
        route: '/daily',
        api: { method: 'POST', path: '/api/daily/stream' },
        turnEventApi: { method: 'GET', path: '/api/turn-events?traceId=<traceId>' },
      }),
    ),
  }
}

function adaptRehearsal(raw) {
  return {
    ...raw,
    datasetName: '03_rehearsal_cases',
    schemaVersion: '2026-06-12',
    targetRoute: '/rehearsal',
    targetApi: '/api/rehearsal/analyze',
    cases: raw.cases.map((c) =>
      patchCase(c, {
        targetFeature: 'rehearsal_analyze',
        route: '/rehearsal',
        api: {
          method: 'POST',
          path: '/api/rehearsal/analyze',
          body: {
            parentText: c.parentOriginalWords ?? '',
            worry: c.parentWorry,
            background: c.background,
            fromSpecialFeature: true,
          },
        },
      }),
    ),
  }
}

function adaptEducationDiagnosis(raw) {
  return {
    ...raw,
    datasetName: '04_education_diagnosis_cases',
    schemaVersion: '2026-06-12',
    targetRoute: '/education-diagnosis',
    targetApi: '/api/education-diagnosis',
    samples: raw.samples.map((s) => ({
      ...s,
      sampleName: normalizeParentText(s.sampleName),
      rounds: s.rounds.map((r) =>
        patchCase(r, {
          targetFeature: 'education_diagnosis',
          route: '/education-diagnosis',
          api: { method: 'POST', path: '/api/education-diagnosis' },
        }),
      ),
    })),
  }
}

function adaptFamilyPlanner(raw) {
  return {
    ...raw,
    datasetName: '05_family_planner_cases',
    schemaVersion: '2026-06-12',
    targetRoute: '/family-planner',
    targetApi: '/api/family-planner',
    cases: raw.cases.map((c) =>
      patchCase(c, {
        targetFeature: 'family_planner',
        route: '/family-planner',
        api: { method: 'POST', path: '/api/family-planner', body: { text: '<parentText>' } },
        parentText: normalizeParentText(c.parentText),
      }),
    ),
  }
}

function adaptMultiView(raw) {
  return {
    ...raw,
    datasetName: '06_multi_view_child_voice_cases',
    schemaVersion: '2026-06-12',
    routes: {
      multiView: '/multi-view',
      childVoice: '/child-voice',
    },
    apis: {
      multiView: { method: 'POST', path: '/api/multi-view' },
      childVoice: { method: 'POST', path: '/api/multi-view' },
    },
    teacherContextPrerequisite: {
      comment: '老师视角需先完成 family 模块 summary，且文本含老师/学校观察',
      entryType: 'family',
      stage: 'summary',
    },
    cases: raw.cases.map((c) =>
      patchCase(c, {
        targetFeature: 'multi_view',
        route: '/child-voice',
        api: {
          method: 'POST',
          path: '/api/multi-view',
          body: { childText: '<childOriginalWords>' },
        },
      }),
    ),
  }
}

function adaptWeeklyReview(raw) {
  return {
    ...raw,
    datasetName: '07_weekly_review_observations',
    schemaVersion: '2026-06-12',
    targetRoute: '/weekly-report',
    targetApi: '/api/profile/weekly-review',
    weeks: raw.weeks.map((w) => ({
      ...w,
      targetFeature: 'weekly_review',
      route: '/weekly-report',
      api: {
        method: 'POST',
        path: '/api/profile/weekly-review',
        body: { observations: '<observations>' },
      },
      observations: w.observations.map((o) => normalizeParentText(o)),
    })),
  }
}

function remapCompleteness(completeness) {
  if (!completeness || typeof completeness !== 'object') return completeness
  const next = {}
  for (const [k, v] of Object.entries(completeness)) {
    next[COMPLETENESS_KEY_MAP[k] ?? k] = v
  }
  return next
}

function adaptProfileSnapshot(raw) {
  return {
    ...raw,
    datasetName: '08_profile_snapshot_seed',
    schemaVersion: '2026-06-12',
    targetApi: '/api/profile/built',
    readinessApi: '/api/profile/readiness',
    snapshots: raw.snapshots.map((s) => ({
      ...s,
      stage: normalizeParentText(s.stage),
      profileSnapshot: s.profileSnapshot
        ? {
            ...s.profileSnapshot,
            coreJudgment: normalizeParentText(s.profileSnapshot.coreJudgment),
            completeness: remapCompleteness(s.profileSnapshot.completeness),
            evidence: s.profileSnapshot.evidence?.map((e) => normalizeParentText(e)),
            verificationPoints: s.profileSnapshot.verificationPoints?.map((e) =>
              normalizeParentText(e),
            ),
          }
        : s.profileSnapshot,
    })),
  }
}

function buildManifest(stats) {
  return {
    version: '2026-06-12',
    source: 'xiaoyin_mom_simulator_expanded_test_data.zip',
    adaptedBy: 'scripts/adapt-xiaoyin-corpus.mjs',
    productFlow: {
      login: '/login',
      buildHub: '/profile/build',
      buildOrder: BUILD_ORDER,
      mainTabs: ['/daily', '/tasks', '/rehearsal', '/family-profile'],
    },
    legacyToBuildEntryType: LEGACY_TO_BUILD,
    changes: [
      '五入口 learning_homework/daily_phone_rhythm/parent_child_communication/emotion_pressure/family_environment → 四模块 daily/homework/communication/family',
      'emotion_pressure 20 轮并入 communication（原话+情绪压力同属沟通模块）',
      'API entryType 使用 daily|homework|communication|family|final，不再使用 study/routine/emotion/environment',
      '路由对齐 /profile/build/{type}、/profile/build/final-follow-up、/profile/generating',
      '年级统一为初二（原 zip 多处写初三，已文本替换；升学压力保留）',
      'hiddenGroundTruth 仍保留，测试脚本禁止喂给 Agent',
    ],
    files: stats,
    recommendedTestOrder: [
      '默认 CORPUS_PHASE=hifi：见 hifiTestOrder',
      '旧专项 CORPUS_PHASE=legacy：见 legacyTestOrder',
      '全部 CORPUS_PHASE=all',
    ],
    hifiTestOrder: [
      '01_profile_build_inputs.json（按 buildOrder 逐模块 entry→followup→summary）',
      '01_profile_build_inputs.json finalFollowUp',
      '/api/synthesis + /api/diagnosis + /api/profile/readiness',
      '02_daily_dialogue_cases.json（按 caseId 顺序，模拟 4 周）',
      '03_rehearsal_cases.json',
      'GET /api/profile/built + /api/profile/snapshot + /api/profile/weekly-review（画像 Tab）',
    ],
    legacyTestOrder: [
      '04_education_diagnosis_cases.json',
      '05_family_planner_cases.json',
      '06_multi_view_child_voice_cases.json',
      '07_weekly_review_observations.json',
      '08_profile_snapshot_seed.json',
    ],
  }
}

function main() {
  ensureDir(OUT_DIR)

  const fiveEntry = readJson('01_five_entry_inputs.json')
  const profileBuild = adaptProfileBuildInputs(fiveEntry)
  writeJson('01_profile_build_inputs.json', profileBuild)

  const daily = adaptDailyDialogue(readJson('02_daily_dialogue_cases.json'))
  writeJson('02_daily_dialogue_cases.json', daily)

  const rehearsal = adaptRehearsal(readJson('03_rehearsal_cases.json'))
  writeJson('03_rehearsal_cases.json', rehearsal)

  const edu = adaptEducationDiagnosis(readJson('04_education_diagnosis_cases.json'))
  writeJson('04_education_diagnosis_cases.json', edu)

  const planner = adaptFamilyPlanner(readJson('05_family_planner_cases.json'))
  writeJson('05_family_planner_cases.json', planner)

  const multiView = adaptMultiView(readJson('06_multi_view_child_voice_cases.json'))
  writeJson('06_multi_view_child_voice_cases.json', multiView)

  const weekly = adaptWeeklyReview(readJson('07_weekly_review_observations.json'))
  writeJson('07_weekly_review_observations.json', weekly)

  const profile = adaptProfileSnapshot(readJson('08_profile_snapshot_seed.json'))
  writeJson('08_profile_snapshot_seed.json', profile)

  const stats = {
    '01_profile_build_inputs.json': {
      modules: profileBuild.modules.map((m) => ({
        entryType: m.entryType,
        rounds: m.roundCount,
      })),
      finalFollowUp: 1,
    },
    '02_daily_dialogue_cases.json': { cases: daily.cases.length },
    '03_rehearsal_cases.json': { cases: rehearsal.cases.length },
    '04_education_diagnosis_cases.json': { samples: edu.samples.length },
    '05_family_planner_cases.json': { cases: planner.cases.length },
    '06_multi_view_child_voice_cases.json': { cases: multiView.cases.length },
    '07_weekly_review_observations.json': { weeks: weekly.weeks.length },
    '08_profile_snapshot_seed.json': { snapshots: profile.snapshots.length },
  }

  writeJson('manifest.json', buildManifest(stats))

  console.log('Adapted corpus written to', OUT_DIR)
  console.log(JSON.stringify(stats, null, 2))
}

main()
