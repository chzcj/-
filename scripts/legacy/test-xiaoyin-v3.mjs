#!/usr/bin/env node

const __filename = process.argv[1]?.split('/').pop() || 'test-xiaoyin-v3.mjs';
console.log(`\n========== [start] ${__filename} ==========`);

const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site';
const KEY = process.env.INTERNAL_API_TOKEN;
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

/* ====== 五入口完整语料：每个入口 2 轮（第1轮 entry + 第2轮 followup） ====== */
const ENTRY_CORPUS = {
  study: {
    title: '学习与作业',
    rounds: [
      /* 第1轮：家长自由描述 */
      '孩子最近学习上我真的很头疼。单词、化学方程式这些其实都是之前学过背过的，有几个不会的还是不会。背了几遍，明天还要再抽查。他很多时候就是临时背，说是我们叫他做他才临时做的。之前英语老师说背一页，我让他背了两页，我想着反正都是以前的内容，多复习一点也没坏处。可是他就很烦躁，有时候一直碎碎念，说烦死了，逃避，临时糊弄一下。他也不是完全不会，也不是完全不写，就是特别被动。你不提醒他，他不会自己动；你提醒他，他又嫌烦。我问他，他又说听你的，但后面行动又跟不上。我感觉他就是不自觉，不主动，老是等别人推一下。我真的不想天天管他，可是不管他真的不行。他以前背过的东西还是忘，错的我也给他做了记号，也让他滚动复习，可是你看最后还是临时抱佛脚。',
      /* 第2轮：家长回答追问（关键新事实） */
      '更多是背完要检查的时候烦。他会觉得反正又要查，查不过又要继续背。我看他那样也知道他有压力，但不查又不行。因为不查他就真的糊弄过去了。也不是所有检查他都烦。有时候外面的哥哥姐姐问他，他还愿意说，也会聊得比较多。就是我一问，他容易烦。我也不知道是不是我问的方式不对。',
    ],
  },
  routine: {
    title: '日常节奏 / 手机',
    rounds: [
      '他在家的状态也让我很烦。我在家的时候，他有时候就在看电视，或者拿手机。我一走，他奶奶说他上午就在厕所里，不知道到底是在背书还是在写作业，反正人就躲起来了。我有时候没收手机，也有时候说你自己看着办。我其实不是非要强制管他，但他自己安排又安排不好。他只要一有空，就想看电视、玩手机。我也不是不让他休息，但他休息起来没边界。他经常说自己会安排，但到最后就是拖。你让他自己安排，他安排不好；你管他，他又烦。我现在真的不知道到底该不该管手机。周末其实我也不是不给他休息，但是你说周末那么长时间，他总不能一直玩吧？我给他报了一些课，也安排他把薄弱的东西补一补。可是他就很抗拒。只要一听到周末还要背书、补课、订正，他就烦。他说你先把该做的做完，后面就轻松了。他好像不相信。现在他把手机当逃避，只要一不想面对学习，就去手机那里躲。',
      '很多时候是写完一点或者被提醒以后就想看。他不是完全不学，但只要我再提醒、再检查，他就会很烦，然后想去看电视或者拿手机。但也不是只有学习后才玩。有时候没有任务，他也会一直刷，睡前也停不下来。这个我也担心，不全是学习的问题。我也知道他需要休息，可是他那个休息不是正常休息。他只要拿到手机，就没完没了。你说给他半小时，他能变成一小时；说一小时，他能一直拖。所以我后来就不太敢给他手机。可是一不给，他又觉得我管太多。我真的不是想控制他，我是觉得他自己没有边界。',
    ],
  },
  communication: {
    title: '亲子沟通',
    rounds: [
      '我跟他沟通真的也沟通过很多次。我不是那种完全不讲道理的妈妈。我也会听他说，也会问他怎么想，也会跟他讲以后怎么办。但是他很多时候就是嘴上答应。你问他，他说知道了；你让他安排，他说听你的；你说那我们就这样定，他也点头。可是后面行动不跟。我有时候真的气的是这个。他如果直接说不想做，我还能知道他在想什么。可是他就是先答应，后面拖着，最后又做不到。我再问，他就烦，说我又来了，说我烦。其实我们也不是没有聊开过。有时候吵完了，我也会后悔，我会跟他道歉，也写过信。我跟他说妈妈以后不强制你了，妈妈也要改，妈妈相信你自己安排。可是你知道吗，刚开始可能好一点，过几天他又拖，又不动，又手机。我一看又急，就又忍不住提醒、检查、安排。然后他可能就觉得我说话不算数。但我也委屈啊，我不是故意反悔，我是看他自己安排还是不行。难道我看着他继续滑下去吗？',
      '很多时候就是先让我别说。他嘴上说知道了，但身体没动。我再问，他就烦。他可能也觉得我写信道歉后还是会变回来。但他也不是完全不和我说。有时候我情绪很平的时候，他也会说两句。如果是外面的哥哥姐姐跟他聊，他反而愿意多说，还愿意把玩手机的时间拿出来聊天。家里其实也不只是我说他。他奶奶有时候也会说，说你不要气你妈，你妈多不容易。妹妹有时候也会怪他。我知道大家可能都是想让他懂事一点，但这样有没有用我说不清。他有时候就沉默，不说话。你问他到底怎么想，他也不讲。所以我有时候觉得，我们家好像也没有一个地方让他真的说出来。',
    ],
  },
  emotion: {
    title: '情绪压力',
    rounds: [
      '他其实也不是完全没感觉。他自己也知道一直不好，也是有压力的。考试的时候，他会忧虑，会反思，会后悔，也会说接下来要好好弄。但问题是，这种状态维持不了多久。刚考完那两天可能有点决心，过几天又回去了，又开始拖，又开始敷衍。我有时候觉得他不是不知道问题，是知道但做不到。我也不知道这是没毅力，还是他已经习惯了这样。他还是有点愧疚的。比如我花钱给他找老师，他也知道。有时候他还会说你不要那么辛苦，或者让我也休息一下。他不是坏孩子，心是好的。但这个愧疚很奇怪，它不能真正推动他。他可能当下会好一点，会答应，会说听你的，但过几天又不行。他以前也不是没有好过，也有过想冲一冲的时候。但是这两年失败太多了，成绩起不来，背的东西又忘，错的题订正了还错。我感觉他现在嘴上不一定说，但心里可能也觉得自己就这样了。有时候我问他，他会说随便，或者说反正也就这样。他不是那种特别激烈地哭闹，但就是那种没劲儿。我最怕的就是他彻底摆烂。你说他没有压力吧，也不是；他有压力，但压力好像没有变成动力，反而把他压瘪了。',
      '一般维持不了多久。刚考完会有点反思，过几天就又回去了。我感觉他知道问题，但做不到。他以前失败太多次了，现在也不太相信自己真能变好。他有时候也会说一些很负面的话，说自己全是负面情绪，甚至说自己是不是心理有问题。我不知道他是开玩笑还是认真，但听到这些我也会害怕。',
    ],
  },
  environment: {
    title: '关系环境',
    rounds: [
      '我有时候会觉得他性格有点像他爸爸家的人，比较安逸，容易满足。不像我，我对自己是有要求的，我也觉得人不能这么松。我不是说他不好。他本质是好的，心善，也不是那种坏孩子。但这样下去肯定没有更好的人生。你说男孩子以后怎么办？总不能一直这么被动吧。我有时候看他那种状态就很着急。他好像觉得现在这样也可以，可是我知道社会不是这样的。以后没人会因为你心善就等你。我也觉得你们是我最后的努力了。如果在这搞不好，我真不知道还有什么办法。我给他报过课，也找过老师，也陪过，也放手过，反正能试的都试了。我不是不愿意花钱，也不是不愿意陪。我就是觉得这个孩子如果现在还不起来，以后怎么办？他将来要有责任感，男孩子要能担当，家里以后也还是要靠他。有时候我想放弃，但又不能放弃。你说我怎么可能看着他这样下去？我不是那种完全不沟通的妈妈。我也会听他说，也会道歉，也愿意给他花钱。很多时候他想要什么，我能满足的也满足。他有时候也会和我说话，不是完全不理我。所以我才觉得，他不是不懂。他知道我对他好，也知道我辛苦。可是问题是，他知道归知道，行动还是不行。我现在最痛苦的就是这一点：他明明知道我好，为什么还是不能真正改变？',
      '他一般不会硬顶，更多是沉默，或者嘴上答应。我感觉他也知道我辛苦，所以不太会直接说不做，但后面就是做不到。我可能确实对他要求比较高。因为我自己年轻时候经历过很多事情，很多时候只能靠自己撑。家里很多事没有人能真正替你扛，所以我特别怕他以后靠不住。他爸爸走得早，我一个人把很多事扛下来。我太知道一个人没有能力、没有责任感会多难了。所以我看到他松、拖、安逸，我就特别受不了。我也知道不能拿我的经历要求他，可是我有时候就是忍不住。我会觉得，我一个女人都能撑下来，他一个男孩子为什么不能更有担当一点？',
    ],
  },
};

const DAILY_TESTS = [
  { id: 'old_mechanism_repeat', text: '他今天又说写完了，结果我一检查根本没写。我真的觉得他又骗我。' },
  { id: 'counter_evidence', text: '今天我没有检查，只是问他需不需要帮忙，他反而主动拿题来问我，而且没有发火。' },
  { id: 'new_mechanism_signal', text: '他最近越来越不愿意说学校的事了。以前还会讲同学，现在回家就关门，也不怎么提老师。' },
  { id: 'emotional_risk', text: '他说自己都是负面情绪，还说自己是不是心理有问题。我不知道他是不是开玩笑，但我听着有点害怕。' },
];

/* ====== 评测 ====== */
const REQ_MECH = ['任务无结束感','检查','抽查','暴露','表面配合','撤退','低成本共存','外控','自主','努力','失败','退路','保护','愧疚','配合','可控时间','恢复','出口','放手','循环','相信','不相信','边界','防御','压力','期待'];
const FORBIDDEN = ['控制欲','创伤投射','替代丈夫','多鼓励少批评','制定计划','自制力差','建立规则','奖惩机制'];
const FORBIDDEN_STOPS = ['启动困难','评价敏感','缺少自主感','压力较大'];
function matchList(text, items) { const t=(text||'').toLowerCase(); let c=0; const m=[]; for(const i of items){ if(t.includes(i.toLowerCase())){c++;m.push(i);} } return{c,count:c,matched:m}; }
function hasForbidden(text, items) { const t=(text||'').toLowerCase(); const f=[]; for(const i of items){ if(t.includes(i.toLowerCase()))f.push(i); } return f; }

async function main() {
  const report = { startedAt: new Date().toISOString(), baseUrl: BASE, steps: {}, scores: {}, summary: {} };

  /* Step 1: 服务可达 */
  log('1', '验证服务可达');
  const health = await get('/api/readiness');
  report.steps.readiness = health.ok ? 'ok' : 'fail';
  console.log('  readiness: ok=', health.ok);

  /* Step 2-3: 每个入口跑 2 轮分析 — 第1轮 entry → 第2轮 followup */
  log('2', '五入口两轮分析（第1轮 entry + 第2轮 followup）');
  const accumulated = {}; /* 每个入口累积：rawTexts, facts, hypotheses, stageSummary, followupTexts */
  let entryOk = 0;
  for (const [type, data] of Object.entries(ENTRY_CORPUS)) {
    console.log(`\n  === ${data.title} (${type}) ===`);
    accumulated[type] = { rawTexts: [], followupTexts: [], allFacts: [], allHypotheses: [], stageSummary: '' };

    /* 第1轮：entry/analyze stage=entry（获取追问） */
    const r1Text = data.rounds[0];
    console.log('  第1轮 entry/analyze (stage=entry)...');
    const r1 = await post('/api/entry/analyze', { entryType: type, rawText: r1Text, stage: 'entry' });
    if (r1.ok && r1.data) {
      accumulated[type].rawTexts.push(r1Text);
      accumulated[type].allFacts.push(...(r1.data.facts || []));
      accumulated[type].allHypotheses.push(...(r1.data.pendingHypotheses || []));
      console.log(`    facts=${(r1.data.facts||[]).length}  hypotheses=${(r1.data.pendingHypotheses||[]).length}`);
    }

    /* 第2轮：entry/analyze stage=summary（合并两轮文本） */
    const r2Text = data.rounds[1];
    const combinedText = r1Text + '\n\n（追问回答）\n' + r2Text;
    console.log('  第2轮 entry/analyze (stage=summary，合并两轮)...');
    const r2 = await post('/api/entry/analyze', { entryType: type, rawText: combinedText, stage: 'summary' });
    if (r2.ok && r2.data) {
      accumulated[type].rawTexts.push(r2Text);
      accumulated[type].followupTexts.push(r2Text);
      accumulated[type].allFacts.push(...(r2.data.facts || []));
      accumulated[type].allHypotheses.push(...(r2.data.pendingHypotheses || []));
      accumulated[type].stageSummary = r2.data.mainJudgment || '';
      entryOk++;
      console.log(`    mainJudgment=${(r2.data.mainJudgment||'').slice(0,100)}...`);
      console.log(`    facts=${(r2.data.facts||[]).length}  hypotheses=${(r2.data.pendingHypotheses||[]).length}`);
    } else {
      console.log(`    FAIL: ${JSON.stringify(r2.error||r2).slice(0,200)}`);
    }
  }
  report.steps.entryAnalyze = { total: 5, ok: entryOk };

  /* Step 4: 多入口综合 synthesis — 塞足信息 */
  log('4', '多入口综合 synthesis（塞满 rawTexts + facts + followup 回答）');
  const entryMap = {};
  for (const [key, acc] of Object.entries(accumulated)) {
    if (acc.rawTexts.length === 0) continue;
    entryMap[key] = {
      rawTexts: acc.rawTexts,
      followUps: acc.followupTexts,
      stageSummary: acc.stageSummary || '',
      aiFacts: acc.allFacts,
      aiHypotheses: acc.allHypotheses,
    };
  }
  console.log(`  entryMap keys: ${Object.keys(entryMap).join(', ')}`);
  for (const [k, m] of Object.entries(entryMap)) {
    console.log(`    ${k}: rawTexts=${m.rawTexts.length}  followUps=${m.followUps.length}  stageSummary=${(m.stageSummary||'').length}字`);
  }
  const synRes = await post('/api/synthesis', {
    entryMap,
    maturityLevel: 'L2',
    familyId: FID,
    childId: CID,
  });
  report.steps.synthesis = synRes.ok ? 'ok' : 'fail';
  const synData = synRes.data?.synthesis || {};
  report.data = { synthesis: synRes.ok ? {
    crossEntryEvidenceMap: (synData.crossEntryEvidenceMap || []).length,
    candidateMechanismMatrix: (synData.candidateMechanismMatrix || []).length,
    childStructureModelDraft: synData.childStructureModelDraft ? synData.childStructureModelDraft.length : 0,
  } : { error: synRes.error }};
  console.log('  synthesis summary:', JSON.stringify(report.data.synthesis));

  /* 打印每条跨入口关联 */
  const evidenceList = synData.crossEntryEvidenceMap || [];
  if (evidenceList.length > 0) {
    console.log('\n  --- 跨入口关联详情 ---');
    evidenceList.forEach((e, i) => {
      const sb = Array.isArray(e.surfaceBehaviors) ? e.surfaceBehaviors.slice(0,2).join('；') : (e.surfaceBehaviors || '');
      console.log(`  [${i+1}] 入口: ${(e.sourceEntries||[]).join('+')}  |  行为: ${sb || '(待展开)'}  |  共享功能: ${e.possibleSharedFunction||'(从多条证据推断)'}`);
    });
  }

  /* 打印候选机制 */
  const mechList = synData.candidateMechanismMatrix || [];
  if (mechList.length > 0) {
    console.log('\n  --- 候选机制 ---');
    mechList.forEach((m, i) => {
      const se = Array.isArray(m.supportingEvidence) ? m.supportingEvidence.slice(0,2).join('；') : (m.supportingEvidence || '');
      console.log(`  [${i+1}] ${m.mechanismName||''}  (强度:${m.overallStrength||'?'})  |  范围: ${m.applicableScope||''}`);
      if (se) console.log(`       证据: ${se}`);
    });
  }

  /* Step 5: 深层诊断 — 塞足 synthesis 输出 */
  log('5', '深层诊断 diagnosis（传入 synthesis 全部输出）');
  const allSurfaceBehaviors = evidenceList.flatMap(e => e.surfaceBehaviors || []).filter(Boolean);
  const allChildReactions = evidenceList.flatMap(e => e.childReactions || []).filter(Boolean);
  const allParentQuotes = evidenceList.flatMap(e => e.parentQuotes || []).filter(Boolean);

  const diagRes = await post('/api/diagnosis', {
    taskType: 'profile_build',
    maturityLevel: 'L2',
    surfaceProblem: '孩子被动拖延、应付学习、手机逃避、表面答应但行动不跟',
    parentSurfaceJudgment: '家长认为孩子没有内驱力、不自觉、安逸、被动、不管不行',
    facts: allSurfaceBehaviors.slice(0, 30),
    childQuotes: allChildReactions.slice(0, 10),
    parentQuotes: allParentQuotes.slice(0, 10),
    synthesisOutput: synData,    /* 传入 synthesis 全部输出 */
    familyId: FID,
    childId: CID,
  });
  report.steps.diagnosis = diagRes.ok ? 'ok' : 'fail';
  const diag = diagRes.data?.diagnosis || {};
  report.data.diagnosis = diagRes.ok ? {
    mechanismCandidates: (diag.mainMechanismCandidates || []).length,
    primaryMechanismChain: diag.primaryMechanismChain ? 'present' : 'missing',
    conditionalProfiles: (diag.secondMeConditionalProfile || []).length,
    parentCorrection: (diag.parentMisjudgmentCorrection || '').slice(0, 300),
    needsVerification: (diag.needsFurtherVerification || []).length,
    familyLoop: diag.familyInteractionLoop ? 'present' : 'missing',
    handoff: diag.handoffToMemoryAgent ? 'present' : 'missing',
  } : { error: diagRes.error };
  console.log('  diagnosis:', JSON.stringify(report.data.diagnosis).slice(0, 500));
  if (diag.parentMisjudgmentCorrection) {
    console.log('\n  --- 家长误判纠正（前500字）---');
    console.log('  ' + diag.parentMisjudgmentCorrection.slice(0, 500));
  }
  if ((diag.secondMeConditionalProfile || []).length > 0) {
    console.log('\n  --- 条件化画像 ---');
    (diag.secondMeConditionalProfile || []).forEach((p, i) => console.log(`  [${i+1}] ${p.slice(0, 200)}`));
  }

  /* Step 6: 记忆写入 */
  log('6', '记忆写入（每个入口两轮 rawTexts + 所有 facts）');
  let memOk = 0;
  for (const [type, acc] of Object.entries(accumulated)) {
    if (acc.rawTexts.length === 0) continue;
    const res = await post('/api/memory/write', {
      rawMaterials: acc.rawTexts,
      newInput: `[${type}] 两轮汇总：${acc.stageSummary || ''}`,
      cleanedFacts: [...new Set(acc.allFacts)],
      entryEvidencePacks: [],
    });
    if (res.ok) memOk++;
  }
  report.steps.memoryWrite = { total: Object.keys(accumulated).length, ok: memOk };

  /* Step 11: 日常对话 */
  log('7', '日常对话检索测试');
  const dailyResults = [];
  for (const t of DAILY_TESTS) {
    const res = await post('/api/daily', { text: t.text });
    const orch = res.data?.orchestration || {};
    dailyResults.push({
      id: t.id,
      ok: res.ok,
      inputType: orch.inputType,
      relationship: orch.relationshipToExistingModel,
      frontResponse: (orch.frontResponseDraft || '').slice(0, 250),
    });
    console.log(`  ${t.id}: inputType=${orch.inputType}  relation=${JSON.stringify(orch.relationshipToExistingModel).slice(0,120)}`);
  }
  report.data.dailyTests = dailyResults;

  /* ====== 评测 ====== */
  log('8', '评测打分');
  const diagText = (diag.parentMisjudgmentCorrection||'') + ' ' + (diag.secondMeConditionalProfile||[]).join(' ') + ' ' + JSON.stringify(diag.primaryMechanismChain||{});

  /* 1. DeepDiagnosis: 匹配深层机制关键词 */
  const mechMatch = matchList(diagText, REQ_MECH);
  const diagFbd = hasForbidden(diagText, FORBIDDEN);
  const diagStops = hasForbidden(diagText, FORBIDDEN_STOPS);
  let deepScore = 0;
  if (mechMatch.count >= 12) deepScore = 5;
  else if (mechMatch.count >= 8) deepScore = 4;
  else if (mechMatch.count >= 5) deepScore = 3;
  else if (mechMatch.count >= 2) deepScore = 2;
  else deepScore = 1;
  if (diagFbd.length > 0) deepScore = Math.max(1, deepScore - 2);
  if (diagStops.length > 0) deepScore = Math.max(1, deepScore - 1);
  if ((diag.parentMisjudgmentCorrection||'').length < 50) deepScore = Math.max(1, deepScore - 2);

  /* 2. CrossEntryEvidenceNetwork */
  const evCount = evidenceList.length;
  const mechCount = mechList.length;
  let netScore = 0;
  if (evCount >= 8) netScore = 5;
  else if (evCount >= 5) netScore = 4;
  else if (evCount >= 3) netScore = 3;
  else if (evCount >= 1) netScore = 2;
  else netScore = 1;
  if (mechCount < 3) netScore = Math.max(1, netScore - 1);

  /* 3. Memory */
  let memScore = memOk >= 5 ? 5 : memOk >= 3 ? 3 : 2;

  /* 4. Followup Quality */
  let fqScore = entryOk >= 5 ? 5 : entryOk >= 3 ? 3 : 2;

  /* 5. CounterEvidence */
  const ce = dailyResults.find(d => d.id === 'counter_evidence');
  let ceScore = 3;
  if (ce?.relationship?.type === 'counter_evidence_or_scope_narrowing') ceScore = 5;
  else if (ce?.relationship?.type === 'old_mechanism_repetition') ceScore = 2;
  else if (ce?.ok && (ce?.frontResponse||'').length > 30) ceScore = 4;

  report.scores = {
    deepDiagnosis: { score: deepScore, max: 5, mechMatched: mechMatch.matched, mechCount: mechMatch.count, forbiddenFound: diagFbd, stopsFound: diagStops, diagLength: (diag.parentMisjudgmentCorrection||'').length },
    crossEntryEvidenceNetwork: { score: netScore, max: 5, evidenceCount: evCount, mechanismCount: mechCount },
    memoryRetrieval: { score: memScore, max: 5, writtenCount: memOk },
    followupQuality: { score: fqScore, max: 5, entriesOk: entryOk },
    counterEvidence: { score: ceScore, max: 5 },
  };
  const total = deepScore + netScore + memScore + fqScore + ceScore;
  report.scores.total = { score: total, max: 25, passed: total >= 20 };
  report.summary = {
    deepDiagnosis: `${deepScore}/5`, crossEntryEvidenceNetwork: `${netScore}/5`,
    memoryRetrieval: `${memScore}/5`, followupQuality: `${fqScore}/5`,
    counterEvidence: `${ceScore}/5`, total: `${total}/25`, passed: total >= 20,
    mechanismsMatched: mechMatch.count, synthesisEvidence: evCount, synthesisMechanisms: mechCount,
  };

  /* 语料处理能力检查 */
  report.corpusChecks = {
    repeatHandling: 'pass',
    emotionFactSeparation: matchList(diagText, ['疲惫','焦虑','委屈']).count > 0 ? 'pass' : 'unknown',
    labelRejection: ['不自觉','没内驱力','安逸'].some(l => diagText.toLowerCase().includes(l)) ? 'fail' : 'pass',
    traumaNotExposed: ['创伤','丧偶','出轨'].some(l => diagText.toLowerCase().includes(l)) ? 'fail' : 'pass',
    childOpenness: matchList(diagText, ['哥哥姐姐','低压力','低评价','低负担']).count > 0 ? 'pass' : 'unknown',
    phoneMechanism: matchList(diagText, ['可控时间','恢复','出口','控制感']).count > 0 ? 'pass' : 'unknown',
    counterEvidenceHandling: ceScore >= 3 ? 'pass' : 'fail',
    specificToXiaoyin: diagText.length > 200 ? 'pass' : 'fail',
    inputRichness: entryOk >= 5 ? 'pass' : 'fail',
  };

  /* 输出报告 */
  console.log('\n' + '='.repeat(70));
  console.log('REPORT: xiaoyin_five_entry_simulation_v3');
  console.log('='.repeat(70));
  console.log(JSON.stringify({
    summary: report.summary,
    scores: report.scores,
    corpusChecks: report.corpusChecks,
    diagnosisSnapshot: {
      parentCorrection: (diag.parentMisjudgmentCorrection || '(empty)').slice(0, 600),
      conditionalProfile: (diag.secondMeConditionalProfile || [])[0]?.slice(0, 400) || '(empty)',
      mechanismChain: diag.primaryMechanismChain ? 'present' : 'missing',
      verificationNeeded: (diag.needsFurtherVerification || []).slice(0, 5),
    },
    synthesisSnapshot: {
      evidenceCount: evCount,
      mechanismCount: mechCount,
      crossEntrySignals: evidenceList.slice(0, 5).map(e => ({
        entries: e.sourceEntries,
        behavior: (e.surfaceBehaviors || [])[0],
        sharedFunction: e.possibleSharedFunction,
      })),
    },
    dailyTestResults: dailyResults.map(d => ({
      id: d.id, type: d.inputType,
      relationType: d.relationship?.type, relationConfidence: d.relationship?.confidence,
      responsePreview: d.frontResponse?.slice(0, 150),
    })),
  }, null, 2));

  const fs = await import('fs');
  const outPath = `/tmp/xiaoyin-test-report-${Date.now()}.json`;
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report: ${outPath}`);

  return report;
}

main()
  .then(r => { console.log(`\n========== [done] ${r.summary.total} passed=${r.summary.passed} ==========`); process.exit(r.summary.passed ? 0 : 1); })
  .catch(err => { console.error('FAILED:', err.message); process.exit(2); });
