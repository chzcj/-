import 'server-only';

import {
  firstPrompt,
  makeA1,
  makeAdvice,
  makeArchive,
  makeRehearsal,
  makeUnderstandingCard
} from '@/lib/mock-data';
import type {
  AdviceCardData,
  ArchiveDraft,
  CardFeedbackType,
  ConversationStateData,
  InputMode,
  RehearsalResultData,
  UnderstandingCardData
} from '@/types/childos';

interface MockStore {
  conversations: Map<string, ConversationStateData>;
  archives: Map<string, ArchiveDraft>;
  correctionLogs: Array<{ conversationId: string; cardId: string; feedbackType: CardFeedbackType; text: string }>;
  memoryRecords: Array<{ archiveId: string; kind: string; summary: string }>;
}

const globalStore = globalThis as typeof globalThis & { __childosMockStore?: MockStore };

const store =
  globalStore.__childosMockStore ||
  (globalStore.__childosMockStore = {
    conversations: new Map<string, ConversationStateData>(),
    archives: new Map<string, ArchiveDraft>(),
    correctionLogs: [],
    memoryRecords: []
  });

const { conversations, archives, correctionLogs, memoryRecords } = store;

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function startConversation(familyId: string, childId: string) {
  const conversationId = createId('conv');
  const conversation: ConversationStateData = {
    familyId,
    childId,
    conversationId,
    currentRound: 1,
    maxRound: 8,
    status: 'active',
    firstPrompt,
    rounds: []
  };
  conversations.set(conversationId, conversation);
  return conversation;
}

export function getConversation(conversationId: string) {
  return conversations.get(conversationId);
}

export function submitAnswer(conversationId: string, round: number, inputMode: InputMode, text: string) {
  const conversation = conversations.get(conversationId);
  if (!conversation) return undefined;

  conversation.rounds.push({
    round,
    inputMode,
    rawText: text,
    summary: summarize(text, round)
  });

  const nextRound = Math.min(round + 1, 7);
  const a1 = makeA1(nextRound, conversation.familyId, conversation.childId, conversationId);
  conversation.currentRound = nextRound;
  conversation.latestA1 = a1;
  conversations.set(conversationId, conversation);
  return a1;
}

export function generateUnderstanding(conversationId: string) {
  const conversation = conversations.get(conversationId);
  if (!conversation) return undefined;
  const card = makeUnderstandingCard(conversation, 1);
  conversation.understandingCard = card;
  conversation.status = 'card_generated';
  conversations.set(conversationId, conversation);
  return card;
}

export function submitFeedback(conversationId: string, cardId: string, feedbackType: CardFeedbackType, text: string) {
  const conversation = conversations.get(conversationId);
  if (!conversation) return undefined;

  if (feedbackType === 'accurate') {
    return { updated: false, cardId, card: conversation.understandingCard };
  }

  correctionLogs.push({ conversationId, cardId, feedbackType, text });
  const nextRevision = (conversation.understandingCard?.version.match(/\d+/)?.[0] ? Number(conversation.understandingCard.version.match(/\d+/)?.[0]) : 1) + 1;
  const updatedCard = makeUnderstandingCard(conversation, nextRevision, text);
  conversation.understandingCard = updatedCard;
  conversations.set(conversationId, conversation);
  return { updated: true, cardId: updatedCard.cardId, card: updatedCard };
}

export function generateRehearsal(conversationId: string, parentText: string): RehearsalResultData | undefined {
  const conversation = conversations.get(conversationId);
  if (!conversation) return undefined;
  const result = makeRehearsal(conversationId, parentText);
  conversation.rehearsalResult = result;
  conversations.set(conversationId, conversation);
  return result;
}

export function generateAdvice(conversationId: string): AdviceCardData | undefined {
  const conversation = conversations.get(conversationId);
  if (!conversation) return undefined;
  const card = makeAdvice(conversationId);
  conversation.adviceCard = card;
  conversations.set(conversationId, conversation);
  return card;
}

export function getOrCreateArchive(conversationId: string): ArchiveDraft | undefined {
  const conversation = conversations.get(conversationId);
  if (!conversation) return undefined;
  const existing = conversation.archiveDraft;
  if (existing) return existing;
  const archive = makeArchive(conversation);
  conversation.archiveDraft = archive;
  conversations.set(conversationId, conversation);
  return archive;
}

export function confirmArchive(conversationId: string, archive: ArchiveDraft) {
  const conversation = conversations.get(conversationId);
  if (!conversation) return undefined;
  archives.set(archive.archiveId, archive);
  conversation.archiveDraft = archive;
  conversation.status = 'archived';
  conversations.set(conversationId, conversation);
  memoryRecords.push(
    { archiveId: archive.archiveId, kind: 'rawEvent', summary: archive.eventSummary },
    { archiveId: archive.archiveId, kind: 'pendingHypothesis', summary: archive.currentClues },
    { archiveId: archive.archiveId, kind: 'familyMemorySummary', summary: '近期出现数学作业开始前拖延与催促抵触场景，需继续观察。' },
    { archiveId: archive.archiveId, kind: 'supportBoardSnapshot', summary: '支持重点：先观察启动点，不急于规则化管控手机。' }
  );
  return { archiveId: archive.archiveId, memoryWriteStatus: 'success' as const };
}

export function debugStore() {
  return {
    conversations: conversations.size,
    archives: archives.size,
    correctionLogs: correctionLogs.length,
    memoryRecords: memoryRecords.length
  };
}

function summarize(text: string, round: number) {
  const trimmed = text.trim();
  if (trimmed.length <= 44) return `第 ${round} 轮：${trimmed}`;
  return `第 ${round} 轮：${trimmed.slice(0, 44)}...`;
}
