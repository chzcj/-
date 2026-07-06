import 'server-only';

import {
  firstPrompt,
  makeA1,
  makeAdvice,
  makeArchive,
  makeRehearsal,
  makeUnderstandingCard
} from '@/lib/mock-data';
import { formatBeijingDate } from '@/lib/beijing-time';
import { DEFAULT_MAX_ROUND, MIN_UNDERSTANDING_ROUND } from '@/lib/conversation-config';
import { agentPrompts } from '@/lib/server/agent-prompts';
import { callAgentJson, callFastJson, callFastTextStream, callParentTextStream, callSupportJson, callSupportTextStream, isFastAIEnabled } from '@/lib/server/ark-agents';
import { buildDiagnosticA1JsonPrompt, buildDiagnosticStreamPrompt, buildUnderstandingSectionPrompt } from '@/lib/server/diagnostic-runtime';
import {
  debugDatabase,
  insertMemoryRecords,
  isDatabaseEnabled,
  loadFamilyBriefMemory,
  loadConversationState,
  rebuildFamilyMemoryDigest,
  saveArchiveDraft,
  saveConversationState
} from '@/lib/server/db';
import type {
  A1Output,
  AdviceCardData,
  ArchiveDraft,
  CardFeedbackType,
  ConversationStateData,
  InputMode,
  RehearsalResultData,
  UnderstandingCardData
} from '@/types/childos';
import { loadDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-store';
import { buildDeepModelDigest } from '@/lib/server/memory/deep-modeling/digest-builder';
import { pickDeepModelDigestPack } from '@/lib/server/memory/deep-modeling/pick-deep-model-digest';

interface MockStore {
  conversations: Map<string, ConversationStateData>;
  archives: Map<string, ArchiveDraft>;
  correctionLogs: Array<{ conversationId: string; cardId: string; feedbackType: CardFeedbackType; text: string }>;
  memoryRecords: Array<{ archiveId: string; kind: string; summary: string }>;
  rehearsalMessages: Map<string, Array<{ role: 'user' | 'assistant'; text: string }>>;
}

const globalStore = globalThis as typeof globalThis & { __childosMockStore?: MockStore };

const store =
  globalStore.__childosMockStore ||
  (globalStore.__childosMockStore = {
    conversations: new Map<string, ConversationStateData>(),
    archives: new Map<string, ArchiveDraft>(),
    correctionLogs: [] as Array<{ conversationId: string; cardId: string; feedbackType: CardFeedbackType; text: string }>,
    memoryRecords: [] as Array<{ archiveId: string; kind: string; summary: string }>,
    rehearsalMessages: new Map() as Map<string, Array<{ role: 'user' | 'assistant'; text: string }>>
  });

const { conversations, archives, correctionLogs, memoryRecords, rehearsalMessages } = store;

// 请求者租户标识，用于会话归属校验（防 IDOR：凭 conversationId 越权访问他人会话）。
type ReqTenant = { familyId: string; childId: string };

async function loadRehearsalDigestPack(tenant?: ReqTenant) {
  if (!tenant) return undefined
  let digest = await loadDeepModelDigest(tenant).catch(() => null)
  if (!digest?.mechanismNarrative) {
    digest = await buildDeepModelDigest(tenant).catch(() => digest)
  }
  return pickDeepModelDigestPack(digest)
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function startConversation(familyId: string, childId: string) {
  const conversationId = createId('conv');
  const conversation: ConversationStateData = {
    familyId,
    childId,
    conversationId,
    currentRound: 1,
    maxRound: DEFAULT_MAX_ROUND,
    status: 'active',
    firstPrompt,
    rounds: []
  };
  conversations.set(conversationId, conversation);
  await persistConversation(conversation);
  return conversation;
}

export async function getConversation(conversationId: string, tenant: ReqTenant) {
  return getCachedOrPersistedConversation(conversationId, tenant);
}

export async function submitAnswer(conversationId: string, tenant: ReqTenant, round: number, inputMode: InputMode, text: string) {
  const conversation = await getCachedOrPersistedConversation(conversationId, tenant);
  if (!conversation) return undefined;

  conversation.rounds.push({
    round,
    inputMode,
    rawText: text,
    summary: summarize(text, round)
  });

  const nextRound = round + 1;
  const fallbackA1 = makeA1(nextRound, conversation.familyId, conversation.childId, conversationId);
  const familyBrief = await safeLoadFamilyBriefMemory(conversation.familyId, conversation.childId);
  const agentA1 = await tryFastJson<A1Output>(buildDiagnosticA1JsonPrompt({ conversation, latestText: text, familyBrief }), {
    conversation: compactConversation(conversation),
    familyBrief,
    latestAnswer: { round, inputMode, text },
    expectedNextRound: nextRound
  });
  const a1 = normalizeA1(agentA1, fallbackA1, conversation, nextRound);
  conversation.currentRound = nextRound;
  conversation.latestA1 = a1;
  conversations.set(conversationId, conversation);
  await persistConversation(conversation);
  return a1;
}

export async function submitAnswerStreaming(
  conversationId: string,
  tenant: ReqTenant,
  round: number,
  inputMode: InputMode,
  text: string,
  onDelta: (delta: string) => void
) {
  const conversation = await getCachedOrPersistedConversation(conversationId, tenant);
  if (!conversation) return undefined;

  conversation.rounds.push({
    round,
    inputMode,
    rawText: text,
    summary: summarize(text, round)
  });

  const nextRound = round + 1;
  const fallbackA1 = makeTextOnlyA1(makeA1(nextRound, conversation.familyId, conversation.childId, conversationId), nextRound);
  const familyBrief = await safeLoadFamilyBriefMemory(conversation.familyId, conversation.childId);
  const streamedText = await tryFastTextStream(
    buildDiagnosticStreamPrompt({ conversation, latestText: text, familyBrief }),
    {
      conversation: compactConversation(conversation),
      familyBrief,
      latestAnswer: { round, inputMode, text },
      expectedNextRound: nextRound
    },
    onDelta
  );

  if (!streamedText) await emitFallbackText(fallbackA1.highlightQuestion.text, onDelta);

  const cardIndex = streamedText?.indexOf('<!--CARD_JSON-->') ?? -1;
  const hasCard = cardIndex !== -1;
  let cardData: { coreInsight?: string; evidenceQuotes?: string[]; whatChildProtects?: string } | undefined;

  if (hasCard && streamedText) {
    const displayText = streamedText.slice(0, cardIndex).trim();
    const jsonText = streamedText.slice(cardIndex + '<!--CARD_JSON-->'.length).trim();
    try { cardData = JSON.parse(jsonText); } catch { /* ignore parse errors */ }
    if (!streamedText) await emitFallbackText(fallbackA1.highlightQuestion.text, onDelta);
    const finalText = (displayText || fallbackA1.highlightQuestion.text).trim();
    const a1: A1Output = {
      ...fallbackA1,
      clientActions: hasCard ? { nextAction: 'confirm_generate_card', nextRoute: '/problem/confirm' } : fallbackA1.clientActions,
      highlightQuestion: {
        ...fallbackA1.highlightQuestion,
        text: finalText
      }
    };
    if (hasCard && cardData?.coreInsight) {
      conversation.cardInsight = {
        coreInsight: cardData.coreInsight,
        evidenceQuotes: cardData.evidenceQuotes || [],
        whatChildProtects: cardData.whatChildProtects
      };
    }
    conversation.currentRound = nextRound;
    conversation.latestA1 = a1;
    conversations.set(conversationId, conversation);
    await persistConversation(conversation);
    return a1;
  }

  const finalText = (streamedText || fallbackA1.highlightQuestion.text).trim();
  const a1: A1Output = {
    ...fallbackA1,
    highlightQuestion: {
      ...fallbackA1.highlightQuestion,
      text: finalText
    }
  };
  conversation.currentRound = nextRound;
  conversation.latestA1 = a1;
  conversations.set(conversationId, conversation);
  await persistConversation(conversation);
  return a1;
}

export async function generateUnderstanding(conversationId: string, tenant: ReqTenant) {
  const conversation = await getCachedOrPersistedConversation(conversationId, tenant);
  if (!conversation) return undefined;
  const fallbackCard = makeUnderstandingCard(conversation, 1);
  const agentCard = await generateUnderstandingFast(conversation, fallbackCard, 1);
  const card = normalizeUnderstandingCard(agentCard, fallbackCard, conversation, 1);
  conversation.understandingCard = card;
  conversation.status = 'card_generated';
  conversations.set(conversationId, conversation);
  await persistConversation(conversation);
  return card;
}

export async function submitFeedback(conversationId: string, tenant: ReqTenant, cardId: string, feedbackType: CardFeedbackType, text: string) {
  const conversation = await getCachedOrPersistedConversation(conversationId, tenant);
  if (!conversation) return undefined;

  if (feedbackType === 'accurate') {
    return { updated: false, cardId, card: conversation.understandingCard };
  }

  correctionLogs.push({ conversationId, cardId, feedbackType, text });
  const nextRevision = (conversation.understandingCard?.version.match(/\d+/)?.[0] ? Number(conversation.understandingCard.version.match(/\d+/)?.[0]) : 1) + 1;
  const fallbackCard = makeUnderstandingCard(conversation, nextRevision, text);
  const addDetailBoost = feedbackType === 'add_detail'
    ? `\n重要：家长补充的细节"${text}"是家长认为最需要加入理解卡的信息，必须在卡片的 current_state 和 basis 区块中明确体现这段补充内容，不能略过。`
    : '';
  const agentCard = await tryFastJson<UnderstandingCardData>(agentPrompts.deepDiagnosis + `\n根据家长反馈修正理解卡，保持原有 UnderstandingCardData 字段和当前前端文案风格。${addDetailBoost}`, {
    conversation: compactConversation(conversation),
    currentCard: compactUnderstandingCard(conversation.understandingCard),
    feedback: { feedbackType, text }
  });
  const updatedCard = normalizeUnderstandingCard(agentCard, fallbackCard, conversation, nextRevision);
  conversation.understandingCard = updatedCard;
  conversations.set(conversationId, conversation);
  await persistConversation(conversation);
  return { updated: true, cardId: updatedCard.cardId, card: updatedCard };
}

export async function generateRehearsal(conversationId: string, tenant: ReqTenant, parentText: string): Promise<RehearsalResultData | undefined> {
  const conversation = await getCachedOrPersistedConversation(conversationId, tenant);
  if (!conversation) return undefined;
  const fallback = makeRehearsal(conversationId, parentText);
  const deepModelDigest = await loadRehearsalDigestPack(tenant);
  const agentResult = await tryFastJson<RehearsalResultData>(
    `${agentPrompts.communicationRehearsal}\n只输出完整 RehearsalResultData JSON，所有字段非空。`,
    {
      conversation: compactConversation(conversation),
      understandingCard: compactUnderstandingCard(conversation.understandingCard),
      parentText,
      deepModelDigest,
    }
  );
  const result: RehearsalResultData = {
    ...fallback,
    ...agentResult,
    schemaVersion: 'childos.rehearsal.output.v1',
    ok: true,
    conversationId,
    rehearsalId: agentResult?.rehearsalId || fallback.rehearsalId,
    parentOriginal: parentText,
    childMayHear: textOr(agentResult?.childMayHear, fallback.childMayHear),
    likelyReaction: textOr(agentResult?.likelyReaction, fallback.likelyReaction),
    saferExpression: textOr(agentResult?.saferExpression, fallback.saferExpression),
    reason: textOr(agentResult?.reason, fallback.reason)
  };
  conversation.rehearsalResult = result;
  conversations.set(conversationId, conversation);
  await persistConversation(conversation);
  return result;
}

export async function submitRehearsalStreaming(
  conversationId: string,
  text: string,
  onDelta: (delta: string) => void,
  tenant?: ReqTenant
) {
  const history = rehearsalMessages.get(conversationId) || [];
  history.push({ role: 'user' as const, text });
  rehearsalMessages.set(conversationId, history);

  const context = history
    .slice(-12)
    .map((m: { role: string; text: string }) => (m.role === 'user' ? `家长：${m.text}` : `AI：${m.text}`))
    .join('\n');

  const deepModelDigest = await loadRehearsalDigestPack(tenant);

  const fullText = await callParentTextStream(
    agentPrompts.communicationRehearsal,
    { history: context, latestMessage: text, deepModelDigest },
    onDelta
  ).catch((error) => {
    console.error('[childos] rehearsal stream failed', error);
    return undefined;
  });

  if (fullText) {
    history.push({ role: 'assistant' as const, text: fullText.trim() });
    rehearsalMessages.set(conversationId, history);
  }

  return fullText?.trim() || undefined;
}

export async function getRehearsalHistory(conversationId: string) {
  return rehearsalMessages.get(conversationId) || [];
}

export async function generateAdvice(conversationId: string, tenant: ReqTenant): Promise<AdviceCardData | undefined> {
  const conversation = await getCachedOrPersistedConversation(conversationId, tenant);
  if (!conversation) return undefined;
  const fallback = makeAdvice(conversationId);
  const agentCard = await tryFastJson<AdviceCardData>(
    `
你是 ChildOS 的行动建议生成 agent。
只输出当前前端 AdviceCardData JSON：schemaVersion, ok, conversationId, adviceId, intro, items。
内容格式参考“建议卡”：
- intro：一句话说明这是基于当前线索的低压力建议。
- items 必须 4 条，每条 title 和正文都不能为空。
- item 1 title 固定为“先做的一件事”，body 写一个最先做的小动作。
- item 2 title 固定为“建议一”，avoid 写要避开的说法，tryThis 写一句可以直接说的话。
- item 3 title 固定为“建议二”，body 写一个可执行的小步骤。
- item 4 title 固定为“接下来先观察”，observe 写后续观察点。
建议必须小、短、可执行，不改产品流程，不输出 Markdown 或解释。
`,
    { conversation: compactConversation(conversation), understandingCard: compactUnderstandingCard(conversation.understandingCard) }
  );
  const card: AdviceCardData = {
    ...fallback,
    ...agentCard,
    schemaVersion: 'childos.advice_card.v1',
    ok: true,
    conversationId,
    adviceId: agentCard?.adviceId || fallback.adviceId,
    intro: textOr(agentCard?.intro, fallback.intro),
    items: normalizeAdviceItems(agentCard?.items, fallback.items)
  };
  conversation.adviceCard = card;
  conversations.set(conversationId, conversation);
  await persistConversation(conversation);
  return card;
}

export async function getOrCreateArchive(conversationId: string, tenant: ReqTenant): Promise<ArchiveDraft | undefined> {
  const conversation = await getCachedOrPersistedConversation(conversationId, tenant);
  if (!conversation) return undefined;
  const existing = conversation.archiveDraft;
  if (existing) return existing;
  const fallback = makeArchive(conversation);
  const agentArchive = await tryFastJson<ArchiveDraft>(
    `
你是 ChildOS 的档案草稿生成 agent。
只输出当前前端 ArchiveDraft JSON：schemaVersion, ok, conversationId, archiveId, date, eventSummary, conflictPoint, currentClues, rehearsalOrAdvice, observationNext。
内容格式参考“本次档案记录”：
- date：今天日期。
- eventSummary：今天发生了什么，2 句以内。
- conflictPoint：主要冲突点，写表层冲突和可能核心。
- currentClues：目前了解到的线索，必须有具体内容。
- rehearsalOrAdvice：沟通预演或建议中的一句可执行表达。
- observationNext：后续观察点，写下一次观察什么。
所有字段都不能为空。
不要诊断，不贴标签，不输出 Markdown 或解释。
`,
    { conversation: compactConversation(conversation) }
  );
  const archive: ArchiveDraft = {
    ...fallback,
    ...agentArchive,
    schemaVersion: 'childos.archive_draft.v1',
    ok: true,
    conversationId,
    archiveId: agentArchive?.archiveId || fallback.archiveId,
    date: formatBeijingDate(),
    eventSummary: textOr(agentArchive?.eventSummary, fallback.eventSummary),
    conflictPoint: textOr(agentArchive?.conflictPoint, fallback.conflictPoint),
    currentClues: textOr(agentArchive?.currentClues, fallback.currentClues),
    rehearsalOrAdvice: textOr(agentArchive?.rehearsalOrAdvice, fallback.rehearsalOrAdvice),
    observationNext: textOr(agentArchive?.observationNext, fallback.observationNext)
  };
  conversation.archiveDraft = archive;
  conversations.set(conversationId, conversation);
  await persistConversation(conversation);
  await safeSaveArchiveDraft(archive);
  return archive;
}

export async function confirmArchive(conversationId: string, tenant: ReqTenant, archive: ArchiveDraft) {
  const conversation = await getCachedOrPersistedConversation(conversationId, tenant);
  if (!conversation) return undefined;
  archives.set(archive.archiveId, archive);
  conversation.archiveDraft = archive;
  conversation.status = 'archived';
  conversations.set(conversationId, conversation);
  await persistConversation(conversation);
  await safeSaveArchiveDraft(archive);

  const fallbackRecords = [
    { archiveId: archive.archiveId, kind: 'rawEvent', summary: archive.eventSummary },
    { archiveId: archive.archiveId, kind: 'pendingHypothesis', summary: archive.currentClues },
    { archiveId: archive.archiveId, kind: 'familyMemorySummary', summary: '近期出现数学作业开始前拖延与催促抵触场景，需继续观察。' },
    { archiveId: archive.archiveId, kind: 'supportBoardSnapshot', summary: '支持重点：先观察启动点，不急于规则化管控手机。' }
  ];
  memoryRecords.push(...fallbackRecords);
  const dbRecords = fallbackRecords.map((record) => ({
    familyId: conversation.familyId,
    childId: conversation.childId,
    conversationId,
    archiveId: archive.archiveId,
    type: record.kind,
    title: record.kind,
    content: record.summary,
    evidence: archive.eventSummary,
    confidence: 'low',
    tags: []
  }));
  await safeInsertMemoryRecords(dbRecords);
  void enrichArchiveMemoryInBackground(conversationId, archive);
  return { archiveId: archive.archiveId, memoryWriteStatus: 'success' as const };
}

export async function debugStore() {
  return {
    mode: {
      database: isDatabaseEnabled(),
      fastai: isFastAIEnabled()
    },
    conversations: conversations.size,
    archives: archives.size,
    correctionLogs: correctionLogs.length,
    memoryRecords: memoryRecords.length,
    database: await safeDebugDatabase()
  };
}

async function enrichArchiveMemoryInBackground(conversationId: string, archive: ArchiveDraft) {
  try {
    const conversation = await getCachedOrPersistedConversation(conversationId);
    if (!conversation) return;
    const memoryPlan = await tryAgent<{
      shouldWrite?: boolean;
      records?: Array<{ type?: string; title?: string; content?: string; evidence?: string; confidence?: string; tags?: string[] }>;
    }>('memoryWrite', '根据本次归档草稿生成后台记忆写入计划。', { conversation: compactConversation(conversation), archive });
    if (memoryPlan?.shouldWrite === false || !Array.isArray(memoryPlan?.records) || memoryPlan.records.length === 0) return;
    await safeInsertMemoryRecords(
      memoryPlan.records.map((record) => ({
        familyId: conversation.familyId,
        childId: conversation.childId,
        conversationId,
        archiveId: archive.archiveId,
        type: record.type || 'pending_hypothesis',
        title: record.title || '本次亲子沟通线索',
        content: record.content || archive.currentClues,
        evidence: record.evidence || archive.eventSummary,
        confidence: record.confidence || 'low',
        tags: record.tags || []
      }))
    );
  } catch (error) {
    console.error('[childos] background memory enrichment failed', error);
  }
}

function summarize(text: string, round: number) {
  const trimmed = text.trim();
  if (trimmed.length <= 44) return `第 ${round} 轮：${trimmed}`;
  return `第 ${round} 轮：${trimmed.slice(0, 44)}...`;
}

async function getCachedOrPersistedConversation(conversationId: string, tenant?: ReqTenant) {
  let conv = conversations.get(conversationId);
  if (!conv) {
    const persisted = await safeLoadConversationState(conversationId);
    if (persisted) {
      conversations.set(conversationId, persisted);
      conv = persisted;
    }
  }
  if (!conv) return undefined;
  // 租户隔离：会话必须属于请求者租户，否则视为不存在（防 IDOR）。
  if (tenant && (conv.familyId !== tenant.familyId || conv.childId !== tenant.childId)) return undefined;
  return conv;
}

async function persistConversation(conversation: ConversationStateData) {
  conversations.set(conversation.conversationId, conversation);
  try {
    await saveConversationState(conversation);
  } catch (error) {
    console.error('[childos] save conversation failed', error);
  }
}

async function safeLoadConversationState(conversationId: string) {
  try {
    return await loadConversationState(conversationId);
  } catch (error) {
    console.error('[childos] load conversation failed', error);
    return undefined;
  }
}

async function safeLoadFamilyBriefMemory(familyId: string, childId: string) {
  try {
    return await loadFamilyBriefMemory(familyId, childId);
  } catch (error) {
    console.error('[childos] load family brief failed', error);
    return undefined;
  }
}

async function safeSaveArchiveDraft(archive: ArchiveDraft) {
  try {
    await saveArchiveDraft(archive);
  } catch (error) {
    console.error('[childos] save archive failed', error);
  }
}

async function safeInsertMemoryRecords(records: Parameters<typeof insertMemoryRecords>[0]) {
  try {
    const count = await insertMemoryRecords(records);
    if (count > 0) await safeRebuildFamilyMemoryDigest(records[0].familyId, records[0].childId);
  } catch (error) {
    console.error('[childos] insert memory records failed', error);
  }
}

async function safeRebuildFamilyMemoryDigest(familyId: string, childId: string) {
  try {
    await rebuildFamilyMemoryDigest(familyId, childId);
  } catch (error) {
    console.error('[childos] rebuild family digest failed', error);
  }
}

async function safeDebugDatabase() {
  try {
    return await debugDatabase();
  } catch (error) {
    console.error('[childos] debug database failed', error);
    return { enabled: isDatabaseEnabled(), error: 'DATABASE_CHECK_FAILED' };
  }
}

async function tryAgent<T>(agent: Parameters<typeof callAgentJson>[0], task: string, payload: unknown) {
  try {
    return await callAgentJson<T>(agent, task, payload);
  } catch (error) {
    console.error(`[childos] ${agent} failed`, error);
    return undefined;
  }
}

async function trySupportTextStream(system: string, payload: unknown, onDelta: (delta: string) => void) {
  try {
    return await callSupportTextStream(system, payload, onDelta);
  } catch (error) {
    console.error('[childos] support stream failed', error);
    return undefined;
  }
}

async function tryFastTextStream(system: string, payload: unknown, onDelta: (delta: string) => void) {
  try {
    return await callFastTextStream(system, payload, onDelta);
  } catch (error) {
    console.error('[childos] fast stream failed', error);
    return trySupportTextStream(system, payload, onDelta);
  }
}

async function tryFastJson<T>(system: string, payload: unknown) {
  try {
    return await callFastJson<T>(system, payload);
  } catch (error) {
    console.error('[childos] fast json failed', error);
    return undefined;
  }
}

async function trySupport<T>(system: string, payload: unknown) {
  try {
    return await callSupportJson<T>(system, payload);
  } catch (error) {
    console.error('[childos] support agent failed', error);
    return undefined;
  }
}

async function generateUnderstandingFast(conversation: ConversationStateData, fallback: UnderstandingCardData, revision: number): Promise<UnderstandingCardData | undefined> {
  const compact = compactConversation(conversation);
  const familyBrief = await safeLoadFamilyBriefMemory(conversation.familyId, conversation.childId);
  const cardInsight = conversation.cardInsight;
  const insightContext = cardInsight
    ? `\n核心洞察："${cardInsight.coreInsight}"\n证据原话：${cardInsight.evidenceQuotes.map((q) => `"${q}"`).join('、')}${cardInsight.whatChildProtects ? `\n孩子在保护：${cardInsight.whatChildProtects}` : ''}`
    : '';

  const specs = [
    {
      id: 'current_state',
      title: '孩子当前的状态',
      task: '描述孩子当前发生了什么。写清表层行为和可能的压力状态，不归因为懒或不自觉。'
    },
    {
      id: 'stuck_point',
      title: '他可能真正卡住的地方',
      task: '指出孩子真正卡住的节点，重点判断是开始前、任务难度、被催后的防御，还是几者叠加。'
    },
    {
      id: 'parent_misread',
      title: '家长容易误会的地方',
      task: '用“家长看到的是 X，但孩子可能体验到 Y”的方式解释误会点。'
    },
    {
      id: 'child_inner_voice',
      title: '孩子可能的内心声音',
      task: '用孩子视角写 2-3 句内心声音，可以使用引号，避免夸张。'
    },
    {
      id: 'observe_next',
      title: '接下来可以先尝试的事',
      task: '给一个很小的下一步观察或开口，不讲大道理，不要求家长马上制定规则。'
    },
    {
      id: 'basis',
      title: '判断依据',
      task: '说明判断依据来自哪些家长描述的事实，提醒这是阶段性理解。'
    }
  ];

  const sections = await Promise.all(
    specs.map(async (spec, index) => {
      const fallbackSection = fallback.sections.find((section) => section.id === spec.id) || fallback.sections[index];
      const sectionTask = insightContext ? `${spec.task}${insightContext}` : spec.task;
      const result = await tryFastJson<{ body?: string | string[] }>(
        buildUnderstandingSectionPrompt({
          sectionTitle: spec.title,
          sectionTask,
          conversation,
          familyBrief
        }),
        { conversation: compact, familyBrief, latestRounds: compact.rounds.slice(-4), section: spec.id, cardInsight }
      );
      return {
        id: spec.id,
        title: spec.title,
        body: bodyOr(result?.body, fallbackSection?.body || '')
      };
    })
  );

  return {
    ...fallback,
    schemaVersion: 'childos.understanding_card.v1',
    ok: true,
    familyId: conversation.familyId,
    childId: conversation.childId,
    conversationId: conversation.conversationId,
    cardId: `uc_${conversation.conversationId}_${revision}`,
    title: '我对孩子的理解',
    version: `v${revision}`,
    isDraft: false,
    sections,
    knowledgeSource: '以上内容参考发展心理学、教育心理学、学习动机与拖延行为相关研究，并结合你刚刚提供的具体场景。',
    feedbackOptions: ['accurate', 'partially_inaccurate', 'edit', 'add_detail']
  };
}

function normalizeA1(agentA1: A1Output | undefined, fallback: A1Output, conversation: ConversationStateData, round: number): A1Output {
  if (!agentA1 || agentA1.schemaVersion !== 'childos.a1.output.v1') return fallback;
  const nextAction = agentA1.clientActions?.nextAction || fallback.clientActions.nextAction;
  const shouldStopAsking = nextAction === 'confirm_generate_card' || nextAction === 'generate_draft_card' || round >= conversation.maxRound;
  return {
    ...fallback,
    ...agentA1,
    schemaVersion: 'childos.a1.output.v1',
    ok: true,
    familyId: conversation.familyId,
    childId: conversation.childId,
    conversationId: conversation.conversationId,
    messageId: agentA1.messageId || `msg_${String(round).padStart(3, '0')}`,
    scene: 'problem_solving',
    highlightQuestion: agentA1.highlightQuestion?.text ? agentA1.highlightQuestion : fallback.highlightQuestion,
    progress: {
      ...fallback.progress,
      ...agentA1.progress,
      currentRound: round,
      minRound: MIN_UNDERSTANDING_ROUND,
      maxRound: conversation.maxRound,
      enoughForUnderstandingCard: Boolean(agentA1.progress?.enoughForUnderstandingCard || round >= MIN_UNDERSTANDING_ROUND),
      shouldStopAsking
    },
    ui: {
      ...fallback.ui,
      ...agentA1.ui,
      showReflectionCard: false,
      showQuickChoices: false,
      quickChoices: []
    },
    clientActions: {
      ...fallback.clientActions,
      ...agentA1.clientActions
    },
    safety: agentA1.safety || fallback.safety
  };
}

function makeTextOnlyA1(a1: A1Output, round: number): A1Output {
  const shouldStopAsking = a1.clientActions.nextAction === 'confirm_generate_card' || a1.clientActions.nextAction === 'generate_draft_card';
  return {
    ...a1,
    messageType: shouldStopAsking ? 'confirm_generate_card' : 'followup_question',
    assistantMessage: undefined,
    progress: {
      ...a1.progress,
      currentRound: round
    },
    ui: {
      showReflectionCard: false,
      showQuestionCard: true,
      showQuickChoices: false,
      quickChoices: []
    }
  };
}

async function emitFallbackText(text: string, onDelta: (delta: string) => void) {
  for (const chunk of text.match(/.{1,6}/g) || [text]) {
    onDelta(chunk);
    await new Promise((resolve) => setTimeout(resolve, 28));
  }
}

function normalizeUnderstandingCard(agentCard: UnderstandingCardData | undefined, fallback: UnderstandingCardData, conversation: ConversationStateData, revision: number): UnderstandingCardData {
  if (!agentCard || agentCard.schemaVersion !== 'childos.understanding_card.v1') return fallback;
  return {
    ...fallback,
    ...agentCard,
    schemaVersion: 'childos.understanding_card.v1',
    ok: true,
    familyId: conversation.familyId,
    childId: conversation.childId,
    conversationId: conversation.conversationId,
    cardId: agentCard.cardId || `uc_${conversation.conversationId}_${revision}`,
    version: agentCard.version || `v${revision}`,
    title: textOr(agentCard.title, fallback.title || '我对孩子的理解'),
    sections: normalizeUnderstandingSections(agentCard.sections, fallback.sections),
    knowledgeSource: textOr(agentCard.knowledgeSource, fallback.knowledgeSource),
    feedbackOptions: ['accurate', 'partially_inaccurate', 'edit', 'add_detail']
  };
}

function normalizeUnderstandingSections(agentSections: UnderstandingCardData['sections'] | undefined, fallbackSections: UnderstandingCardData['sections']) {
  if (!Array.isArray(agentSections) || agentSections.length === 0) return fallbackSections;
  return fallbackSections.map((fallbackSection, index) => {
    const agentSection = agentSections.find((section) => section.id === fallbackSection.id) || agentSections[index];
    if (!agentSection) return fallbackSection;
    return {
      ...fallbackSection,
      ...agentSection,
      id: agentSection.id || fallbackSection.id,
      title: textOr(agentSection.title, fallbackSection.title),
      body: bodyOr(agentSection.body, fallbackSection.body)
    };
  });
}

function normalizeAdviceItems(agentItems: AdviceCardData['items'] | undefined, fallbackItems: AdviceCardData['items']) {
  if (!Array.isArray(agentItems) || agentItems.length === 0) return fallbackItems;
  return fallbackItems.map((fallbackItem, index) => {
    const agentItem = agentItems[index];
    if (!agentItem) return fallbackItem;
    return {
      ...fallbackItem,
      ...agentItem,
      title: textOr(agentItem.title, fallbackItem.title),
      avoid: textOr(agentItem.avoid, fallbackItem.avoid),
      tryThis: textOr(agentItem.tryThis, fallbackItem.tryThis),
      body: textOr(agentItem.body, fallbackItem.body),
      observe: textOr(agentItem.observe, fallbackItem.observe)
    };
  });
}

function textOr(value: unknown, fallback: string | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback || '';
}

function bodyOr(value: unknown, fallback: string | string[]) {
  if (Array.isArray(value)) {
    const filtered = value.filter((line) => typeof line === 'string' && line.trim()).map((line) => line.trim());
    if (filtered.length > 0) return filtered;
  }
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

function compactConversation(conversation: ConversationStateData) {
  return {
    familyId: conversation.familyId,
    childId: conversation.childId,
    conversationId: conversation.conversationId,
    currentRound: conversation.currentRound,
    rounds: conversation.rounds.map((round) => ({
      round: round.round,
      inputMode: round.inputMode,
      rawText: round.rawText,
      summary: round.summary
    })),
    latestQuestion: conversation.latestA1?.highlightQuestion?.text,
    card: compactUnderstandingCard(conversation.understandingCard),
    rehearsal: conversation.rehearsalResult
      ? {
          parentOriginal: conversation.rehearsalResult.parentOriginal,
          childMayHear: conversation.rehearsalResult.childMayHear,
          likelyReaction: conversation.rehearsalResult.likelyReaction,
          saferExpression: conversation.rehearsalResult.saferExpression,
          reason: conversation.rehearsalResult.reason
        }
      : undefined
  };
}

function compactUnderstandingCard(card?: UnderstandingCardData) {
  if (!card) return undefined;
  return {
    cardId: card.cardId,
    title: card.title,
    version: card.version,
    sections: card.sections.map((section) => ({
      id: section.id,
      title: section.title,
      body: section.body
    }))
  };
}
