#!/usr/bin/env node
/* synthesis 输入策略对比测试：完整输入 vs 纯结构输入 */

const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site';
const KEY = process.env.INTERNAL_API_TOKEN;
const h = { 'Content-Type': 'application/json', 'x-api-key': KEY };

async function post(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try { const r = await fetch(`${BASE}${url}`, { method: 'POST', headers: h, body: JSON.stringify(body), signal: ctrl.signal }); return r.json(); }
  catch(e) { return { ok: false, error: { message: e.message } }; }
  finally { clearTimeout(timer); }
}

const CORPUS = {
  study: [ `孩子最近学习上我真的很头疼。单词、化学方程式这些其实都是之前学过背过的，有几个不会的还是不会。背了几遍，明天还要再抽查。他很多时候就是临时背，说是我们叫他做他才临时做的。之前英语老师说背一页，我让他背了两页，我想着反正都是以前的内容，多复习一点也没坏处。可是他就很烦躁，有时候一直碎碎念，说烦死了，逃避，临时糊弄一下。他也不是完全不会，也不是完全不写，就是特别被动。你不提醒他，他不会自己动；你提醒他，他又嫌烦。我问他，他又说听你的，但后面行动又跟不上。我感觉他就是不自觉，不主动，老是等别人推一下。我真的不想天天管他，可是不管他真的不行。`,
  `更多是背完要检查的时候烦。他会觉得反正又要查，查不过又要继续背。我看他那样也知道他有压力，但不查又不行。因为不查他就真的糊弄过去了。也不是所有检查他都烦。有时候外面的哥哥姐姐问他，他还愿意说，也会聊得比较多。就是我一问，他容易烦。我也不知道是不是我问的方式不对。` ],
  routine: [ `他在家的状态也让我很烦。我在家的时候，他有时候就在看电视，或者拿手机。我一走，他奶奶说他上午就在厕所里。我有时候没收手机，也有时候说你自己看着办。我其实不是非要强制管他，但他自己安排又安排不好。他只要一有空，就想看电视、玩手机。我也不是不让他休息，但他休息起来没边界。周末我给他报了一些课，也安排他把薄弱的东西补一补。可是他就很抗拒。只要一听到周末还要背书、补课、订正，他就烦。`, `很多是写完一点或被提醒后就去看。不是完全不学，但我再提醒、检查他就很烦，想去看电视或拿手机。但也不是只学习后才玩。有时没任务也一直刷，睡前停不下来。后来我不敢给他手机，但不给又觉得我管太多。我真的不是想控制他，是觉得他自己没边界。` ],
  communication: [ `我跟他沟通真的也沟通过很多次。我不是那种完全不讲道理的妈妈。但他很多时候就是嘴上答应。他说知道了，听你的，也点头。可是后面行动不跟。我有时候真的气的是这个。吵完了我也会后悔，道歉，写过信，说不强制了，相信他自己安排。刚开始好一点，过几天他又拖、又手机。我又急，忍不住提醒、检查。他可能觉得我说话不算数。但我也委屈啊，我不是故意反悔，我是看他安排还是不行。`, `他就是先让我别说。嘴上说知道了，身体没动。我再问他就烦。但他也不是完全不和我说。外面哥哥姐姐跟他聊，他反而愿意多说，愿意把玩手机时间拿出来聊天。家里不只是我说他，奶奶也说不要气你妈，妹妹也怪他。他有时候就沉默。` ],
  emotion: [ `他其实也不是完全没感觉。考完会忧虑、反思、后悔，说接下来好好弄。但这种状态维持不了多久。刚考完有决心，过几天又拖又敷衍。他有愧疚，知道我花钱找老师，会说你不要这么辛苦。但愧疚不能推动他。这两年失败太多，成绩起不来，背的忘，错了订正还错。问他就说随便，反正也就这样。不是激烈哭闹，就是没劲儿。`, `一般维持不了多久。刚考完有反思，过几天又回去。他知道问题但做不到。失败太多次，不太相信自己能变好。有时也说很负面的话，说自己是不是心理有问题。` ],
  environment: [ `我有时候会觉得他性格有点像他爸爸家的人，比较安逸，容易满足。不像我对自己有要求。他不是不好，心善，不是坏孩子。但这样下去没有更好的人生。男孩子以后怎么办？你们是我最后的努力了。报过课找过老师陪过放手过，都试了。我不愿意放弃。男孩子要有责任担当，家里以后要靠他。他知道我对他好，知道我辛苦。但知道归知道，行动还是不行。`, `他一般不会硬顶，更多沉默或嘴上答应。我确实对他要求高。我自己经历很多事情，他爸爸走得早，我一个人扛下来。看到他松、拖、安逸就受不了。我知道不能拿我经历要求他，但就是忍不住。` ],
};

async function analyzeEntry(type, texts) {
  const combined = texts.join('\n');
  const r = await post('/api/entry/analyze', { entryType: type, rawText: combined, stage: 'summary' });
  if (!r.ok) throw new Error(`entry ${type} failed: ${JSON.stringify(r.error)}`);
  return { mainJudgment: r.data.mainJudgment, facts: r.data.facts || [], hypotheses: r.data.pendingHypotheses || [] };
}

async function testSynthesis(label, entryMap) {
  console.log(`\n  >>> ${label} <<<`);
  console.log(`      入口数: ${Object.keys(entryMap).length}`);
  for (const [k, m] of Object.entries(entryMap)) {
    console.log(`      ${k}: rawTexts=${m.rawTexts.length}  facts=${(m.aiFacts||[]).length}  hypotheses=${(m.aiHypotheses||[]).length}  stageSummary=${(m.stageSummary||'').length}字`);
  }
  const t0 = Date.now();
  const r = await post('/api/synthesis', { entryMap, maturityLevel: 'L2', familyId: 'test_cmp', childId: 'test_cmp' });
  const ms = Date.now() - t0;
  const syn = r.data?.synthesis || {};
  const evCount = (syn.crossEntryEvidenceMap || []).length;
  const mechCount = (syn.candidateMechanismMatrix || []).length;
  const mechNames = (syn.candidateMechanismMatrix || []).map(m => m.mechanismName);
  const hasContent = (syn.crossEntryEvidenceMap || []).some(e => (e.surfaceBehaviors || []).length > 0);
  console.log(`      耗时: ${ms}ms  跨入口关联: ${evCount}  机制数: ${mechCount}  有实质内容: ${hasContent}`);
  console.log(`      机制名: ${mechNames.join(' | ')}`);
  return { label, ms, evCount, mechCount, mechNames, hasContent, ok: r.ok };
}

async function testDiagnosis(label, synthOutput) {
  console.log(`\n  >>> ${label} (diagnosis) <<<`);
  const handoff = synthOutput.diagnosisHandoffPackage || {};
  const t0 = Date.now();
  const r = await post('/api/diagnosis', {
    taskType: 'profile_build', maturityLevel: 'L2',
    surfaceProblem: '孩子被动拖延、应付学习、手机逃避',
    parentSurfaceJudgment: '没有内驱力、不自觉、安逸、被动、不管不行',
    synthesisOutput: synthOutput,
    familyId: 'test_cmp', childId: 'test_cmp',
  });
  const ms = Date.now() - t0;
  const diag = r.data?.diagnosis || {};
  const hasCorrection = (diag.parentMisjudgmentCorrection || '').length > 50;
  const hasProfile = (diag.secondMeConditionalProfile || []).length > 0;
  console.log(`      耗时: ${ms}ms  纠正长度: ${(diag.parentMisjudgmentCorrection||'').length}字  画像条数: ${(diag.secondMeConditionalProfile||[]).length}`);
  if (hasCorrection) console.log(`      纠正前200字: ${diag.parentMisjudgmentCorrection.slice(0, 200)}`);
  return { label, ms, hasCorrection, hasProfile, correctionLen: (diag.parentMisjudgmentCorrection||'').length, ok: r.ok };
}

async function main() {
  console.log('========================================');
  console.log('synthesis 输入策略对比测试 (deepseek-v4-pro)');
  console.log('========================================');

  /* 第一步：跑五入口分析，收集 AI 结果 */
  console.log('\n[Phase 1] 五入口分析...');
  const aiResults = {};
  for (const [type, texts] of Object.entries(CORPUS)) {
    const result = await analyzeEntry(type, texts);
    aiResults[type] = result;
    console.log(`  ${type}: facts=${result.facts.length} hypotheses=${result.hypotheses.length} mainJudgment=${result.mainJudgment.slice(0,60)}...`);
  }

  /* 第二步：构建两种 entryMap */
  // A: 完整输入 — 截断版
  const fullMap = {};
  for (const [type] of Object.entries(CORPUS)) {
    fullMap[type] = {
      rawTexts: CORPUS[type].map(t => t.slice(0, 200)),
      followUps: [],
      stageSummary: aiResults[type].mainJudgment,
      aiFacts: aiResults[type].facts,
      aiHypotheses: aiResults[type].hypotheses,
    };
  }

  // B: 纯结构 — rawTexts 空数组
  const slimMap = {};
  for (const [type] of Object.entries(CORPUS)) {
    slimMap[type] = {
      rawTexts: [],
      followUps: [],
      stageSummary: aiResults[type].mainJudgment,
      aiFacts: aiResults[type].facts,
      aiHypotheses: aiResults[type].hypotheses,
    };
  }

  // C: 混合 — rawTexts 首轮前150字
  const mixMap = {};
  for (const [type] of Object.entries(CORPUS)) {
    mixMap[type] = {
      rawTexts: [CORPUS[type][0].slice(0, 150)],
      followUps: [],
      stageSummary: aiResults[type].mainJudgment,
      aiFacts: aiResults[type].facts,
      aiHypotheses: aiResults[type].hypotheses,
    };
  }

  /* 第三步：三组对比测试 */
  console.log('\n[Phase 2] synthesis 三组对比...');

  const synthResults = [];
  synthResults.push(await testSynthesis('A-完整输入(原始文本+AI分析)', fullMap));
  synthResults.push(await testSynthesis('B-纯结构(仅AI分析)', slimMap));
  synthResults.push(await testSynthesis('C-混合(首轮文本+AI分析)', mixMap));

  /* 第四步：两组 diagnosis 对比 — 拿最好的 synthesis 结果 */
  console.log('\n[Phase 3] diagnosis 对比（用最好的 synthesis 输出）...');
  const bestSynth = synthResults.sort((a,b) => b.evCount - a.evCount)[0];

  const diagResults = [];

  // A: 换不同诊断策略
  for (const s of synthResults.slice(0, 2)) {
    // 用 API 重新调用 diagnosis（不同 synthesis 输入）
    const diag = await post('/api/diagnosis', {
      taskType: 'profile_build', maturityLevel: 'L2',
      surfaceProblem: '孩子被动拖延、应付学习、手机逃避',
      parentSurfaceJudgment: '没有内驱力、不自觉、安逸、被动',
      synthesisOutput: { candidateMechanismMatrix: [], crossEntryEvidenceMap: [], /* 空 */ },
      facts: [
        '孩子单词和化学方程式存在反复背诵和抽查',
        '孩子在被提醒后被检查时烦躁',
        '家长曾把背一页扩展为背两页',
        '孩子在追加背诵和抽查场景中逃避',
        '孩子常说知道了但行动不跟',
      ],
      childQuotes: ['听你的', '知道了', '反正也就这样'],
      parentQuotes: ['我没有强制管', '我都是为了他好', '我真的很累', '不管真的不行'],
      familyId: 'test_cmp', childId: 'test_cmp',
    });
    const d = diag.data?.diagnosis || {};
    diagResults.push({
      label: `D-${s.label}`,
      correctionLen: (d.parentMisjudgmentCorrection||'').length,
      profileCount: (d.secondMeConditionalProfile||[]).length,
      correction: (d.parentMisjudgmentCorrection||'').slice(0, 300),
    });
  }

  /* 第五步：输出汇总报告 */
  console.log('\n========================================');
  console.log('对比结果汇总');
  console.log('========================================');

  console.log('\n--- synthesis 对比 ---');
  console.log('方案 | 跨入口关联 | 机制数 | 实质内容 | 耗时');
  for (const s of synthResults) {
    console.log(`${s.label.slice(0,2)} | ${s.evCount} | ${s.mechCount} | ${s.hasContent} | ${s.ms}ms`);
  }

  console.log('\n--- diagnosis 对比 ---');
  for (const d of diagResults) {
    console.log(`${d.label}: 纠正=${d.correctionLen}字 画像=${d.profileCount}条`);
    console.log(`  前300字: ${d.correction}`);
  }

  console.log('\n=== 测试完成 ===');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
