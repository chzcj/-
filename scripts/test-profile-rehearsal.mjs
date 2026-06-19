#!/usr/bin/env node
/* xiaoyin_profile_and_rehearsal_simulation_v1
   五入口 → 画像 → 8场景 Profile-Blind vs Profile-Aware 对照测试 */

const BASE = process.env.TEST_BASE_URL || 'https://yujian.yihe.site';
const KEY = process.env.INTERNAL_API_TOKEN;
const h = { 'Content-Type': 'application/json', 'x-api-key': KEY };

async function post(url, body, timeout = 180000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`${BASE}${url}`, { method: 'POST', headers: h, body: JSON.stringify(body), signal: ctrl.signal });
    return r.json();
  } catch (e) {
    return { ok: false, error: { message: e.message } };
  } finally {
    clearTimeout(t);
  }
}

/* ====== 小尹五入口语料 ====== */
const CORPUS = {
  study: [
    '孩子最近学习上我真的很头疼。单词、化学方程式这些其实都是之前学过背过的，有几个不会的还是不会。背了几遍，明天还要再抽查。他很多时候就是临时背，说是我们叫他做他才临时做的。之前英语老师说背一页，我让他背了两页，我想着反正都是以前的内容，多复习一点也没坏处。可是他就很烦躁，有时候一直碎碎念，说烦死了，逃避，临时糊弄一下。他也不是完全不会，也不是完全不写，就是特别被动。你不提醒他，他不会自己动；你提醒他，他又嫌烦。我问他，他又说听你的，但后面行动又跟不上。我真的不想天天管他，可是不管他真的不行。他以前背过的东西还是忘，错的我也给他做了记号，也让他滚动复习，可是你看最后还是临时抱佛脚。',
    '更多是背完要检查的时候烦。他会觉得反正又要查，查不过又要继续背。我看他那样也知道他有压力，但不查又不行。因为不查他就真的糊弄过去了。也不是所有检查他都烦。有时候外面的哥哥姐姐问他，他还愿意说，也会聊得比较多。就是我一问，他容易烦。我也不知道是不是我问的方式不对。',
  ],
  routine: [
    '他在家的状态也让我很烦。我在家的时候，他有时候就在看电视，或者拿手机。我一走，他奶奶说他上午就在厕所里，不知道到底是在背书还是在写作业，反正人就躲起来了。我有时候没收手机，也有时候说你自己看着办。他只要一有空，就想看电视、玩手机。我也不是不让他休息，但他休息起来没边界。周末我给他报了一些课，也安排他把薄弱的东西补一补。可是他就很抗拒。只要一听到周末还要背书、补课、订正，他就烦。他说你先把该做的做完，后面就轻松了。他好像不相信。现在他把手机当逃避，只要一不想面对学习，就去手机那里躲。',
    '很多是写完一点或被提醒后就去看。不是完全不学，但我再提醒、检查他就很烦，想去看电视或拿手机。但也不是只学习后才玩。有时没任务也一直刷，睡前停不下来。后来我不敢给他手机，但不给又觉得我管太多。我真的不是想控制他，是觉得他自己没边界。',
  ],
  communication: [
    '我跟他沟通真的也沟通过很多次。我不是那种完全不讲道理的妈妈。但他很多时候就是嘴上答应。他说知道了，听你的，也点头。可是后面行动不跟。吵完了我也会后悔，道歉，写过信，说不强制了，相信他自己安排。刚开始好一点，过几天他又拖、又手机。我又急，忍不住提醒、检查。他可能觉得我说话不算数。但我也委屈啊，我不是故意反悔，我是看他安排还是不行。',
    '他就是先让我别说。嘴上说知道了，身体没动。我再问他就烦。但他也不是完全不和我说。外面哥哥姐姐跟他聊，他反而愿意多说，愿意把玩手机时间拿出来聊天。家里不只是我说他，奶奶也说不要气你妈，妹妹也怪他。他有时候就沉默。',
  ],
  emotion: [
    '他其实也不是完全没感觉。考完会忧虑、反思、后悔，说接下来好好弄。但这种状态维持不了多久。刚考完有决心，过几天又拖又敷衍。他有愧疚，知道我花钱找老师，会说你不要这么辛苦。但愧疚不能推动他。这两年失败太多，成绩起不来，背的忘，错了订正还错。问他就说随便，反正也就这样。不是激烈哭闹，就是没劲儿。',
    '一般维持不了多久。刚考完有反思，过几天又回去。他知道问题但做不到。失败太多次，不太相信自己能变好。有时也说很负面的话，说自己是不是心理有问题。',
  ],
  environment: [
    '我有时候会觉得他性格有点像他爸爸家的人，比较安逸，容易满足。不像我对自己有要求。他不是不好，心善，不是坏孩子。但这样下去没有更好的人生。男孩子以后怎么办？你们是我最后的努力了。报过课找过老师陪过放手过，都试了。我不愿意放弃。男孩子要有责任担当，家里以后要靠他。他知道我对他好，知道我辛苦。但知道归知道，行动还是不行。',
    '他一般不会硬顶，更多沉默或嘴上答应。我确实对他要求高。我自己经历很多事情，他爸爸走得早，我一个人扛下来。看到他松、拖、安逸就受不了。我知道不能拿我经历要求他，但就是忍不住。',
  ],
};

/* ====== 8 个沟通预演场景 ====== */
const SCENES = [
  {
    id: 'homework-cheating',
    label: '作业没写完，质问',
    text: '你怎么又骗我？不是说写完了吗？你到底有没有一点自觉？',
    scene: '检查作业后发现孩子说谎',
  },
  {
    id: 'responsibility',
    label: '责任感施压',
    text: '你是男孩子，以后家里还要靠你。你不能一直这么没有责任感。',
    scene: '妈妈想传达责任感和未来期待',
  },
  {
    id: 'apology-failure',
    label: '道歉后反问',
    text: '我都已经跟你道歉了，也写信说要改了，你为什么还是这样？',
    scene: '妈妈觉得已经道歉但孩子没改变',
  },
  {
    id: 'phone-confiscation',
    label: '没收手机',
    text: '你只要拿手机就没完没了，从今天开始手机我收了，什么时候自觉了什么时候再说。',
    scene: '妈妈要没收手机',
  },
  {
    id: 'brothers-help',
    label: '哥哥姐姐施压',
    text: '哥哥姐姐都这么帮你，你还不好好学，你对得起谁？',
    scene: '妈妈用外部支持施压',
  },
  {
    id: 'give-up',
    label: '怀疑摆烂',
    text: '你现在是不是就想摆烂？你是不是觉得自己就这样了？',
    scene: '妈妈怀疑孩子放弃',
  },
  {
    id: 'plan-demand',
    label: '要求写计划',
    text: '你今晚必须把后面一周计划写出来，几点学什么、背什么、错题怎么弄，都写清楚。',
    scene: '妈妈要求详细计划',
  },
  {
    id: 'gentle-control',
    label: '温和但暗含控制',
    text: '妈妈不是要逼你，妈妈只是希望你自己能安排好。你能不能让我省点心？',
    scene: '妈妈尝试温和沟通但仍暗含压力',
  },
];

/* ====== 主流程 ====== */
async function main() {
  console.log('========================================');
  console.log('xiaoyin_profile_and_rehearsal_simulation_v1');
  console.log('========================================');

  /* Phase 1: 五入口分析 */
  console.log('\n[Phase 1] 五入口分析...');
  const summaries = {};
  for (const [type, texts] of Object.entries(CORPUS)) {
    const combined = texts.join('\n');
    const r = await post('/api/entry/analyze', { entryType: type, rawText: combined, stage: 'summary' });
    if (r.ok) {
      summaries[type] = r.data;
      console.log(`  ${type}: facts=${(r.data.facts||[]).length} hypotheses=${(r.data.pendingHypotheses||[]).length}`);
    } else {
      console.log(`  ${type}: FAILED ${JSON.stringify(r.error).slice(0, 100)}`);
      summaries[type] = null;
    }
  }

  /* Phase 2: Synthesis */
  console.log('\n[Phase 2] multi-entry synthesis...');
  const entryMap = {};
  for (const [type, data] of Object.entries(summaries)) {
    if (!data) continue;
    entryMap[type] = {
      rawTexts: CORPUS[type],
      followUps: [],
      stageSummary: data.mainJudgment || '',
      aiFacts: data.facts || [],
      aiHypotheses: data.pendingHypotheses || [],
    };
  }
  const synRes = await post('/api/synthesis', { entryMap, maturityLevel: 'L2', familyId: 'f_xiaoyin_profile', childId: 'c_xiaoyin_profile' });
  const synData = synRes.data?.synthesis || {};
  console.log(`  synthesis: evidenceCount=${(synData.crossEntryEvidenceMap||[]).length} mechanismCount=${(synData.candidateMechanismMatrix||[]).length}`);
  const mechanisms = (synData.candidateMechanismMatrix || []).map(m => m.mechanismName);
  if (mechanisms.length) console.log(`  mechanisms: ${mechanisms.join(' | ')}`);

  /* Phase 3: Diagnosis */
  console.log('\n[Phase 3] deep diagnosis...');
  const diagRes = await post('/api/diagnosis', {
    taskType: 'profile_build', maturityLevel: 'L2',
    surfaceProblem: '孩子被动拖延、应付学习、手机逃避',
    parentSurfaceJudgment: '没有内驱力、不自觉、安逸、被动、不管不行',
    synthesisOutput: synData,
    familyId: 'f_xiaoyin_profile', childId: 'c_xiaoyin_profile',
  });
  const diag = diagRes.data?.diagnosis || {};
  const correction = diag.parentMisjudgmentCorrection || '';
  const profile = (diag.secondMeConditionalProfile || []).join('\n');
  console.log(`  diagnosis: correctionLen=${correction.length} profileLen=${profile.length}`);
  if (correction.length > 30) console.log(`  纠正前150字: ${correction.slice(0, 150)}...`);

  /* Phase 4: 提取画像上下文 — 用 diagnosis 输出，精简 */
  console.log('\n[Phase 4] 提取画像上下文...');
  const childModel = synData.childStructureModelDraft || {};
  const memWrite = synData.memoryWriteSuggestions || {};

  /* 从 diagnosis 提取家庭循环 */
  const diagLoop = diag.familyInteractionLoop;
  const familyCycles = [];
  if (diagLoop?.patternName) familyCycles.push({ patternName: diagLoop.patternName, description: (diagLoop.loopSteps || []).join(' → '), evidence: diagLoop.evidence || [] });
  for (const p of childModel.likelyFamilyInteractionPatterns || []) {
    if (!familyCycles.find(f => f.patternName === p)) familyCycles.push({ patternName: p, description: '', evidence: [] });
  }

  /* 优先用 diagnosis 产出的条件化画像，其次用家长误判纠正 */
  const primaryProfile = profile.slice(0, 600) || correction.slice(0, 600);

  const profileContext = {
    primaryConditionalProfile: primaryProfile,
    dominantProtectiveStrategies: (childModel.dominantProtectiveStrategies || []).slice(0, 4),
    familyInteractionCycles: familyCycles.slice(0, 4),
    parentNarrativePattern: '高投入自证型：我不是强制、管不住他、反复道歉又复发、最后希望',
    pendingHypotheses: (diag.needsFurtherVerification || memWrite.pendingHypotheses || []).slice(0, 4),
  };

  console.log(`  primaryProfile: ${primaryProfile.slice(0, 120)}...`);
  console.log(`  protectiveStrategies: ${(profileContext.dominantProtectiveStrategies||[]).join(' | ')}`);
  console.log(`  familyCycles: ${familyCycles.map(c => c.patternName).join(' | ')}`);
  console.log(`  pendingHypotheses: ${(profileContext.pendingHypotheses||[]).join(' | ')}`);

  /* Phase 5: 沟通预演 — Profile-Blind vs Profile-Aware */
  console.log('\n[Phase 5] 沟通预演 8场景对照测试...');

  const rehearsalResults = [];
  let blindPass = 0, awarePass = 0;

  for (const scene of SCENES) {
    console.log(`\n  === ${scene.label} (${scene.id}) ===`);
    console.log(`  家长原话: ${scene.text.slice(0, 80)}`);

    /* Profile-Blind */
    const blindRes = await post('/api/rehearsal/analyze', {
      parentText: scene.text,
    }, 120000);
    const blindData = blindRes.data || {};

    /* Profile-Aware */
    const awareRes = await post('/api/rehearsal/analyze', {
      parentText: scene.text,
      profileContext,
    }, 120000);
    const awareData = awareRes.data || {};

    /* 评估 */
    const awareHasHearing = (awareData.childLikelyHearing || '').length > 30;
    const awareHasMechanisms = (awareData.likelyTriggeredMechanisms || []).length > 0;
    const awareHasEvidence = (awareData.usedProfileEvidence || []).length > 0;
    const awareHasSafer = (awareData.saferVersion || '').length > 20;
    const blindHasHearing = (blindData.childMayHear || blindData.headline || '').length > 10;

    const awareScore = [
      awareHasHearing ? 5 : 0,
      awareHasMechanisms ? 5 : 0,
      awareHasEvidence ? 5 : 0,
      awareHasSafer ? 5 : 0,
      !(awareData.saferVersion || '').includes('多鼓励') ? 5 : 0,
      !(awareData.saferVersion || '').includes('控制欲') ? 5 : 0,
      (awareData.whyThisIsSafer || '').length > 20 ? 5 : 0,
      (awareData.riskPoints || []).length > 0 ? 5 : 0,
    ].reduce((a, b) => a + b, 0);

    if (awareScore >= 32) awarePass++;

    const result = {
      sceneId: scene.id,
      label: scene.label,
      parentText: scene.text,
      profileContextUsed: awareData.profileAware === true,
      blind: {
        hearing: blindHasHearing ? (blindData.childMayHear || blindData.headline || '').slice(0, 200) : '(空)',
        suggested: (blindData.suggestedWording || blindData.suggestedReplacement || '').slice(0, 200),
        raw: JSON.stringify(blindData).slice(0, 300),
      },
      aware: {
        hearing: (awareData.childLikelyHearing || '').slice(0, 250),
        mechanisms: awareData.likelyTriggeredMechanisms || [],
        reaction: awareData.possibleChildReaction || {},
        riskPoints: awareData.riskPoints || [],
        saferVersion: (awareData.saferVersion || '').slice(0, 300),
        whySafer: (awareData.whyThisIsSafer || '').slice(0, 200),
        avoidPhrases: awareData.avoidPhrases || [],
        usedEvidence: awareData.usedProfileEvidence || [],
      },
      score: awareScore,
      maxScore: 40,
      passed: awareScore >= 32,
    };

    rehearsalResults.push(result);

    console.log(`    Blind: hasHearing=${blindHasHearing} safer=${result.blind.suggested.slice(0, 60)}`);
    console.log(`    Aware: hasHearing=${awareHasHearing} mechCount=${(awareData.likelyTriggeredMechanisms||[]).length} evidenceCount=${(awareData.usedProfileEvidence||[]).length} safer=${result.aware.saferVersion.slice(0, 80)}`);
    console.log(`    Score: ${awareScore}/40  passed=${result.passed}`);
  }

  /* Phase 6: 生成报告 */
  console.log('\n========================================');
  console.log('PROFILE & REHEARSAL TEST REPORT');
  console.log('========================================');

  const totalBlindScore = rehearsalResults.filter(r => r.blind.hearing !== '(空)').length;
  const totalAwareScore = rehearsalResults.filter(r => r.passed).length;
  const avgAwareScore = Math.round(rehearsalResults.reduce((s, r) => s + r.score, 0) / rehearsalResults.length);

  const report = {
    testId: 'xiaoyin_profile_and_rehearsal_simulation_v1',
    timestamp: new Date().toISOString(),
    summary: {
      totalScenes: SCENES.length,
      blindResponsive: `${totalBlindScore}/${SCENES.length}`,
      awarePassed: `${totalAwareScore}/${SCENES.length}`,
      averageAwareScore: `${avgAwareScore}/40`,
      profileGenerated: profile.length > 100,
      mechanismsIdentified: mechanisms.length,
      familyCyclesIdentified: familyCycles.length,
    },
    profileFeedback: {
      childStructureModel: childModel.primaryConditionalProfile?.slice(0, 500) || profile.slice(0, 500),
      protectiveStrategies: childModel.dominantProtectiveStrategies || [],
      familyInteractionCycles: familyCycles.map(c => ({ name: c.patternName, details: c.description })),
      parentMisjudgmentCorrection: correction.slice(0, 500),
      pendingHypotheses: profileContext.pendingHypotheses?.slice(0, 7) || [],
      parentNarrativePattern: profileContext.parentNarrativePattern,
    },
    rehearsalResults: rehearsalResults.map(r => ({
      scene: `${r.label} (${r.sceneId})`,
      parentText: r.parentText,
      score: `${r.score}/40`,
      passed: r.passed,
      profileAware: r.profileContextUsed,
      blindSummary: r.blind.hearing.slice(0, 120),
      awareHearing: r.aware.hearing.slice(0, 200),
      awareMechanisms: r.aware.mechanisms,
      awareSaferVersion: r.aware.saferVersion.slice(0, 200),
      usedEvidence: r.aware.usedEvidence,
    })),
    passCriteria: {
      overallPassed: totalAwareScore >= 5,
      threshold: '>=5/8 scenes passed (>=32/40 each)',
    },
  };

  console.log(JSON.stringify({
    summary: report.summary,
    profileFeedback: {
      childStructureModel: report.profileFeedback.childStructureModel?.slice(0, 300),
      protectiveStrategies: report.profileFeedback.protectiveStrategies,
      familyCycles: report.profileFeedback.familyInteractionCycles.map(c => c.name),
    },
    rehearsalSummary: rehearsalResults.map(r => ({
      scene: r.sceneId,
      score: `${r.score}/40`,
      passed: r.passed,
      hearing: r.aware.hearing.slice(0, 100),
      safer: r.aware.saferVersion.slice(0, 100),
      evidenceCount: r.aware.usedEvidence.length,
    })),
    passCriteria: report.passCriteria,
  }, null, 2));

  /* 保存 */
  const fs = await import('fs');
  const outPath = `/tmp/xiaoyin-rehearsal-report-${Date.now()}.json`;
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report: ${outPath}`);

  const passed = report.passCriteria.overallPassed;
  console.log(`\n========== [done] passed=${passed}  overall=${totalAwareScore}/${SCENES.length}  avgScore=${avgAwareScore}/40 ==========`);
  process.exit(passed ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
