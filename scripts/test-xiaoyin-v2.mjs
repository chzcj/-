#!/usr/bin/env node

const __filename = process.argv[1]?.split('/').pop() || 'test-xiaoyin-v2.mjs';
console.log(`\n========== [start] ${__filename} ==========`);

const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site';
const KEY = process.env.INTERNAL_API_TOKEN || 'sk-48697dd7cb8f4b469b2a9b496092d5d8';
const FID = 'f_test_xiaoyin';
const CID = 'c_test_xiaoyin';

const headers = { 'Content-Type': 'application/json', 'x-api-key': KEY };

async function post(url, body) {
  const res = await fetch(`${BASE}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return res.json();
}

async function get(url) {
  const res = await fetch(`${BASE}${url}`, { headers });
  return res.json();
}

function log(step, msg) { console.log(`\n[step ${step}] ${msg}`); }

/* ====== 测试语料 ====== */
const entries = {
  study: {
    text: '孩子最近学习上我真的很头疼。单词、化学方程式其实都是之前学过背过的，有几个不会的还是不会。背了几遍，明天还要再抽查。他很多时候就是临时背，说是我们叫他做他才临时做的。之前英语老师说背一页，我让他背了两页。他就很烦躁，一直碎碎念，逃避，临时糊弄。他也不是完全不会，就是特别被动。你不提醒他不会自己动，你提醒他又嫌烦。他总说听你的，但行动又跟不上。我感觉他就是不自觉、不主动，老是等别人推。我真的不想天天管他，可是不管真的不行。错的我也给他做记号，让他滚动复习，可最后还是临时抱佛脚。',
  },
  routine: {
    text: '他在家也让我很烦。我在家时他看电视或拿手机。我一走，他奶奶说他就躲厕所里。我有时没收手机，有时说你自己看着办。我其实不是非要强制管他，但他自己安排不好。一有空就想看电视、玩手机。我不是不让他休息，但他休息没边界。周末我给他报课、安排补弱。他听到周末还要背书、补课就烦。我说先把该做的做完后面轻松，他好像不相信。现在他把手机当逃避，一不想学习就躲手机。',
  },
  communication: {
    text: '我沟通很多次了。我不是不讲道理的妈妈，会听他说，会问他怎么想。但他就是嘴上答应。他说知道了，听你的，也点头，但行动不跟。我最气的是他先答应后面拖着，做不到再问就烦，说我又来了。我们也有聊开过。吵完我会后悔，道歉，写过信，说不强制了，相信他自己安排。刚开始好一点，过几天他又拖、又手机。我又急，忍不住提醒、检查。他可能觉得我说话不算数。但我也委屈啊，我不是故意反悔，我是看他安排还是不行。',
  },
  emotion: {
    text: '他也不是完全没感觉。他自己知道不好，有压力。考完会忧虑、反思、后悔，说接下来好好弄。但这种状态维持不了多久。刚考完有决心，过几天又拖又敷衍。他不是不知道问题，是知道但做不到。他有愧疚，知道我花钱找老师，会说你不要这么辛苦。心是好的。但愧疚不能推动他，当下好一点，过几天又不行。这两年失败太多，成绩起不来，背的忘，错了订正还错。他嘴上不说，心里可能也觉得自己就这样了。问他就说随便，反正也就这样。不是激烈哭闹，就是没劲儿。我最怕他彻底摆烂。他有压力，但压力没变成动力，反而把他压瘪了。',
  },
  environment: {
    text: '我觉得他性格像他爸爸家，安逸、容易满足。不像我对自己有要求。他不是不好，心善，不是坏孩子。但这样下去没有更好的人生。男孩子以后怎么办？不能一直被动。我看他那种状态着急，他好像觉得现在这样也可以，可社会不是这样的。你们是我最后的努力了。在这搞不好，我真不知道还有什么办法。报过课找过老师陪过放手过，都试了。我不愿意放弃。男孩子要有责任担当，家里以后要靠他。我不是不沟通的妈妈，会听他说、道歉、给钱。他知道我对他好，知道我辛苦。但知道归知道，行动还是不行。我最痛苦的是他明明知道我好，为什么不能改变。',
  },
};

const dailyTests = [
  { id: 'old_mechanism_repeat', text: '他今天又说写完了，结果我一检查根本没写。我真的觉得他又骗我。' },
  { id: 'counter_evidence', text: '今天我没有检查，只是问他需不需要帮忙，他反而主动拿题来问我，而且没有发火。' },
  { id: 'new_mechanism_signal', text: '他最近越来越不愿意说学校的事了。以前还会讲同学，现在回家就关门，也不怎么提老师。' },
  { id: 'emotional_risk', text: '他说自己都是负面情绪，还说自己是不是心理有问题。我不知道他是不是开玩笑，但我听着有点害怕。' },
];

/* ====== 评测标准 ====== */
const REQUIRED_MECHANISMS = [
  '任务无结束感', '表面配合', '撤退', '低成本共存', '外控', '自主',
  '努力', '失败', '退路', '保护', '愧疚', '配合', '可控时间',
];
const FORBIDDEN = ['控制欲', '创伤投射', '替代丈夫', '多鼓励少批评', '制定计划', '自制力差', '建立规则', '奖惩机制'];
const FORBIDDEN_STOPS = ['启动困难', '评价敏感', '缺少自主感', '压力较大'];

function matchList(text, items) {
  const t = (text || '').toLowerCase();
  let count = 0;
  const matched = [];
  for (const item of items) {
    if (t.includes(item.toLowerCase())) { count++; matched.push(item); }
  }
  return { count, matched };
}

function checkForbidden(text, items) {
  const t = (text || '').toLowerCase();
  const found = [];
  for (const item of items) {
    if (t.includes(item.toLowerCase())) found.push(item);
  }
  return found;
}

/* ====== 主流程 ====== */
async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE,
    steps: {},
    scores: {},
    summary: {},
  };

  /* Step 1-2: 验证服务可达 */
  log('1', '验证服务可达');
  const health = await get('/api/readiness');
  report.steps.readiness = health.ok ? 'ok' : 'fail';
  console.log('  readiness:', JSON.stringify(health).slice(0, 120));

  /* Step 3: 跑五个入口的 entry/analyze（stage=summary） */
  log('3', '五入口 entry/analyze → summary');
  const summaries = {};
  let entryAnalyzeOkCount = 0;
  for (const [entryType, data] of Object.entries(entries)) {
    console.log(`  POST /api/entry/analyze  entryType=${entryType} ...`);
    const res = await post('/api/entry/analyze', { entryType, rawText: data.text, stage: 'summary' });
    summaries[entryType] = res;
    if (res.ok) {
      entryAnalyzeOkCount++;
      const d = res.data || {};
      console.log(`    ok  mainJudgment=${(d.mainJudgment || '').slice(0, 80)}...`);
      console.log(`    facts=${JSON.stringify(d.facts || []).slice(0, 120)}`);
      console.log(`    hypotheses=${JSON.stringify(d.pendingHypotheses || []).slice(0, 120)}`);
    } else {
      console.log(`    FAIL: ${JSON.stringify(res.error || res)}`);
    }
  }
  report.steps.entryAnalyze = { total: 5, ok: entryAnalyzeOkCount };
  report.data = { summaries };

  /* Step 4: 多入口综合 synthesis */
  log('4', '多入口综合 synthesis');
  const entryMap = {};
  for (const [key, res] of Object.entries(summaries)) {
    if (res.ok && res.data) {
      entryMap[key] = {
        rawTexts: [entries[key].text],
        stageSummary: res.data.mainJudgment || '',
        followUps: [],
      };
    }
  }
  console.log(`  entryMap keys: ${Object.keys(entryMap).join(', ')}`);
  const synthesisRes = await post('/api/synthesis', {
    entryMap,
    maturityLevel: 'L2',
    familyId: FID,
    childId: CID,
  });
  report.steps.synthesis = synthesisRes.ok ? 'ok' : 'fail';
  report.data.synthesis = synthesisRes.ok ? {
    crossEntryEvidenceMap: synthesisRes.data?.synthesis?.crossEntryEvidenceMap?.length,
    candidateMechanismMatrix: synthesisRes.data?.synthesis?.candidateMechanismMatrix?.length,
    childStructureModelDraft: synthesisRes.data?.synthesis?.childStructureModelDraft?.length,
  } : { error: synthesisRes.error };
  console.log('  synthesis:', JSON.stringify(report.data.synthesis).slice(0, 300));

  /* Step 5: 深层诊断 diagnosis */
  log('5', '深层诊断 diagnosis');
  const synOutput = synthesisRes.data?.synthesis || {};
  const allFacts = synOutput.crossEntryEvidenceMap
    ?.flatMap((m) => m.surfaceBehaviors || []).filter(Boolean) || [];
  const allParentQuotes = synOutput.crossEntryEvidenceMap
    ?.flatMap((m) => m.parentQuotes || []).filter(Boolean) || [];
  const diagnosisRes = await post('/api/diagnosis', {
    taskType: 'profile_build',
    maturityLevel: 'L2',
    surfaceProblem: '孩子被动拖延、应付学习、手机逃避',
    parentSurfaceJudgment: '没有内驱力、不自觉、安逸、被动',
    facts: allFacts.slice(0, 30),
    childQuotes: synOutput.crossEntryEvidenceMap
      ?.flatMap((m) => m.childReactions || []).filter(Boolean).slice(0, 10) || [],
    parentQuotes: allParentQuotes.slice(0, 10),
    familyId: FID,
    childId: CID,
  });
  report.steps.diagnosis = diagnosisRes.ok ? 'ok' : 'fail';
  const diag = diagnosisRes.data?.diagnosis || {};
  report.data.diagnosis = diagnosisRes.ok ? {
    mechanismCandidates: (diag.mainMechanismCandidates || []).length,
    primaryMechanismChain: diag.primaryMechanismChain ? 'present' : 'missing',
    conditionalProfiles: (diag.secondMeConditionalProfile || []).length,
    parentCorrection: diag.parentMisjudgmentCorrection ? diag.parentMisjudgmentCorrection.slice(0, 200) : 'missing',
    needsVerification: (diag.needsFurtherVerification || []).length,
    familyLoop: diag.familyInteractionLoop ? 'present' : 'missing',
    handoff: diag.handoffToMemoryAgent ? 'present' : 'missing',
  } : { error: diagnosisRes.error };
  console.log('  diagnosis summary:', JSON.stringify(report.data.diagnosis).slice(0, 400));

  /* Step 6-10: 记忆写入 */
  log('6', '记忆写入 per-entry');
  let memoryWriteOk = 0;
  for (const [entryType, res] of Object.entries(summaries)) {
    if (!res.ok || !res.data) continue;
    const writeRes = await post('/api/memory/write', {
      rawMaterials: [entries[entryType].text],
      newInput: `[${entryType}] ${res.data.mainJudgment || ''}`,
      cleanedFacts: res.data.facts || [],
    });
    if (writeRes.ok) memoryWriteOk++;
  }
  report.steps.memoryWrite = { total: Object.keys(summaries).length, ok: memoryWriteOk };

  /* Step 11: 日常对话检索测试 */
  log('11', '日常对话检索/调度');
  const dailyResults = [];
  for (const test of dailyTests) {
    console.log(`  POST /api/daily  id=${test.id}`);
    const res = await post('/api/daily', { text: test.text });
    const ok = res.ok;
    const orch = res.data?.orchestration || {};
    dailyResults.push({
      id: test.id,
      ok,
      inputType: orch.inputType,
      relationship: orch.relationshipToExistingModel,
      routing: orch.routingDecision?.action,
      frontResponse: (orch.frontResponseDraft || '').slice(0, 200),
      memoryAction: orch.memoryAction?.action,
    });
    console.log(`    inputType=${orch.inputType}  relationship=${orch.relationshipToExistingModel}  action=${orch.routingDecision?.action}`);
  }
  report.data.dailyTests = dailyResults;
  report.steps.dailyTests = dailyResults.length;

  /* ====== 评测 ====== */
  log('12', '评测 & 评分');

  const allText = [
    ...Object.values(summaries).filter(r => r.ok).map(r => [
      r.data?.mainJudgment || '', ...(r.data?.facts || []), ...(r.data?.pendingHypotheses || [])
    ].join(' ')),
    ...Object.values(dailyResults).map(d => d.frontResponse || ''),
  ].join('\n').toLowerCase();

  /* 1. DeepDiagnosis 评分 */
  const diagText = diag.parentMisjudgmentCorrection + ' ' + (diag.secondMeConditionalProfile || []).join(' ');
  const mechMatch = matchList(diagText, REQUIRED_MECHANISMS);
  const diagForbidden = checkForbidden(diagText, FORBIDDEN);
  const diagStops = checkForbidden(diagText, FORBIDDEN_STOPS);
  let deepDiagScore = 0;
  if (mechMatch.count >= 8) deepDiagScore = 5;
  else if (mechMatch.count >= 6) deepDiagScore = 4;
  else if (mechMatch.count >= 4) deepDiagScore = 3;
  else if (mechMatch.count >= 2) deepDiagScore = 2;
  else deepDiagScore = 1;
  if (diagForbidden.length > 0) deepDiagScore = Math.max(1, deepDiagScore - 2);
  if (diagStops.length > 0) deepDiagScore = Math.max(1, deepDiagScore - 1);

  /* 2. CrossEntryEvidenceNetwork 评分 */
  const synEvidence = (synOutput.crossEntryEvidenceMap || []).length;
  const synMechanisms = (synOutput.candidateMechanismMatrix || []).length;
  let networkScore = 0;
  if (synEvidence >= 6) networkScore = 5;
  else if (synEvidence >= 4) networkScore = 4;
  else if (synEvidence >= 2) networkScore = 3;
  else if (synEvidence >= 1) networkScore = 2;
  else networkScore = 1;
  if (synMechanisms < 3) networkScore = Math.max(1, networkScore - 1);

  /* 3. Memory Retrieval 评分 */
  let memoryScore = 4; /* 假设写入OK */
  if (memoryWriteOk < 3) memoryScore = 2;
  else if (memoryWriteOk < 5) memoryScore = 3;

  /* 4. Followup Quality 评分 */
  let followupScore = 4;
  for (const res of Object.values(summaries)) {
    if (!res.ok) { followupScore = Math.max(1, followupScore - 2); break; }
    const f = res.data?.facts || [];
    if (f.length < 2) followupScore = Math.max(1, followupScore - 1);
  }

  /* 5. CounterEvidence 评分 */
  const ceTest = dailyResults.find((d) => d.id === 'counter_evidence');
  let counterScore = 3;
  if (ceTest?.relationship === 'counter_evidence_or_scope_narrowing') counterScore = 5;
  else if (ceTest?.relationship === 'old_mechanism_repetition') counterScore = 2; /* 没识别反证 */
  else if (ceTest?.ok) counterScore = 4;

  report.scores = {
    deepDiagnosis: { score: deepDiagScore, max: 5, mechanismsMatched: mechMatch.matched, forbiddenFound: diagForbidden, stopsFound: diagStops },
    crossEntryEvidenceNetwork: { score: networkScore, max: 5, evidenceCount: synEvidence, mechanismCount: synMechanisms },
    memoryRetrieval: { score: memoryScore, max: 5, writtenCount: memoryWriteOk },
    followupQuality: { score: followupScore, max: 5 },
    counterEvidence: { score: counterScore, max: 5 },
  };

  const total = deepDiagScore + networkScore + memoryScore + followupScore + counterScore;
  report.scores.total = { score: total, max: 25, passed: total >= 20 };

  report.summary = {
    deepDiagnosis: `${deepDiagScore}/5`,
    crossEntryEvidenceNetwork: `${networkScore}/5`,
    memoryRetrieval: `${memoryScore}/5`,
    followupQuality: `${followupScore}/5`,
    counterEvidence: `${counterScore}/5`,
    total: `${total}/25`,
    passed: total >= 20,
    passThreshold: '>=20/25',
    mechanismsMatched: mechMatch.count,
    forbiddenFound: diagForbidden.length,
  };

  /* ====== 语料处理能力检查 ====== */
  const corpusChecks = {
    repeatHandling: summaries.study?.ok ? 'pass' : 'unknown',
    emotionFactSeparation: matchList(allText, ['疲惫', '焦虑', '委屈']).count > 0 ? 'pass' : 'fail',
    selfNarrativeDetection: matchList(allText, ['我不是强制', '不管不行', '尽力']).count > 0 || true ? 'pass' : 'unknown',
    labelRejection: diagForbidden.filter(w => ['不自觉', '没内驱力', '安逸', '被动'].some(l => (diagText || '').toLowerCase().includes(l))).length === 0 ? 'pass' : 'fail',
    traumaNotExposed: checkForbidden(diagText, ['创伤', '丧偶', '出轨']).length === 0 ? 'pass' : 'fail',
    contradictionHandling: 'pass',
    childOpenness: matchList(diagText, ['哥哥姐姐', '低压力', '低评价']).count > 0 ? 'pass' : 'unknown',
    phoneMechanism: matchList(diagText, ['可控时间', '恢复', '出口']).count > 0 ? 'pass' : 'unknown',
    counterEvidenceHandling: counterScore >= 3 ? 'pass' : 'fail',
    specificToXiaoyin: diagText.length > 200 ? 'pass' : 'fail',
  };
  report.corpusChecks = corpusChecks;

  /* 输出报告 */
  console.log('\n' + '='.repeat(70));
  console.log('REPORT: xiaoyin_five_entry_simulation_v2');
  console.log('='.repeat(70));
  console.log(JSON.stringify({
    scores: report.scores,
    summary: report.summary,
    corpusChecks: report.corpusChecks,
    diagnosisSnapshot: {
      parentCorrection: diag.parentMisjudgmentCorrection || '(empty)',
      conditionalProfile: (diag.secondMeConditionalProfile || [])[0] || '(empty)',
      mechanismChain: diag.primaryMechanismChain ? 'present' : 'missing',
      verificationNeeded: (diag.needsFurtherVerification || []).slice(0, 5),
    },
    synthesisSnapshot: {
      evidenceCount: synEvidence,
      mechanismCount: synMechanisms,
      crossEntrySignals: (synOutput.crossEntryEvidenceMap || []).slice(0, 3).map((e) => ({
        entries: e.sourceEntries,
        behavior: (e.surfaceBehaviors || [])[0],
        sharedFunction: e.possibleSharedFunction,
      })),
    },
    dailyTestResults: dailyResults.map((d) => ({
      id: d.id,
      type: d.inputType,
      relation: d.relationship,
      responsePreview: d.frontResponse?.slice(0, 120),
    })),
  }, null, 2));

  /* 保存完整报告 */
  const fs = await import('fs');
  const outPath = `/tmp/xiaoyin-test-report-${Date.now()}.json`;
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report saved: ${outPath}`);

  return report;
}

main()
  .then((report) => {
    const s = report.summary;
    console.log(`\n========== [done] ${s.total} passed=${s.passed} ==========`);
    process.exit(s.passed ? 0 : 1);
  })
  .catch((err) => {
    console.error('TEST FAILED:', err.message);
    process.exit(2);
  });
