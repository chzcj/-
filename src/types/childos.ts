export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'failed';
export type AIState = 'idle' | 'thinking' | 'streaming' | 'success' | 'error' | 'timeout';
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type CardFeedbackType = 'accurate' | 'partially_inaccurate' | 'edit' | 'add_detail';
export type NextStepType = 'rehearsal' | 'advice' | 'archive_only';
export type InputMode = 'voice' | 'text';

export interface ApiErrorBody {
  code: string;
  message: string;
  detail?: unknown;
  // 错误分类（统一错误码体系）：errorType 区分 校验/临时/永久；retriable=true 时前端可自动重试。
  errorType?: 'validation' | 'temporary' | 'permanent';
  retriable?: boolean;
}

export type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: ApiErrorBody; requestId: string };

export interface FirstPrompt {
  question: string;
  hint: string;
}

export interface QuickChoice {
  label: string;
  value: string;
}

export interface A1Output {
  schemaVersion: 'childos.a1.output.v1';
  ok: boolean;
  familyId: string;
  childId: string;
  conversationId: string;
  messageId: string;
  messageType: 'opening_question' | 'followup_question' | 'reflection_question' | 'confirm_generate_card';
  scene: 'problem_solving';
  assistantMessage?: {
    text: string;
    tone: 'calm' | 'warm' | 'caution';
  };
  highlightQuestion: {
    text: string;
    inputHint?: string;
  };
  progress: {
    currentRound: number;
    minRound: number;
    maxRound: number;
    enoughForUnderstandingCard: boolean;
    shouldStopAsking: boolean;
  };
  ui: {
    showReflectionCard: boolean;
    showQuestionCard: boolean;
    showQuickChoices: boolean;
    quickChoices?: QuickChoice[];
  };
  clientActions: {
    nextAction: 'continue_question' | 'confirm_generate_card' | 'generate_draft_card' | 'go_next_step' | 'safety_stop';
    nextRoute: string;
  };
  memoryCandidates?: Array<{
    type: string;
    summary: string;
    evidenceText: string;
  }>;
  safety: {
    riskLevel: 'none' | 'low' | 'medium' | 'high';
    needsHumanSupport: boolean;
    message: string;
  };
}

export interface UnderstandingSection {
  id: string;
  title: string;
  body: string | string[];
}

export interface UnderstandingCardData {
  schemaVersion: 'childos.understanding_card.v1';
  ok: boolean;
  familyId: string;
  childId: string;
  conversationId: string;
  cardId: string;
  title: string;
  version: string;
  isDraft: boolean;
  sections: UnderstandingSection[];
  knowledgeSource: string;
  feedbackOptions: CardFeedbackType[];
}

export interface RehearsalResultData {
  schemaVersion: 'childos.rehearsal.output.v1';
  ok: boolean;
  conversationId: string;
  rehearsalId: string;
  parentOriginal: string;
  childMayHear: string;
  likelyReaction: string;
  saferExpression: string;
  reason: string;
}

export interface AdviceItem {
  title: string;
  avoid?: string;
  tryThis?: string;
  body?: string;
  observe?: string;
}

export interface AdviceCardData {
  schemaVersion: 'childos.advice_card.v1';
  ok: boolean;
  conversationId: string;
  adviceId: string;
  intro: string;
  items: AdviceItem[];
}

export interface ArchiveDraft {
  schemaVersion: 'childos.archive_draft.v1';
  ok: boolean;
  conversationId: string;
  archiveId: string;
  date: string;
  eventSummary: string;
  conflictPoint: string;
  currentClues: string;
  rehearsalOrAdvice?: string;
  observationNext: string;
}

export interface ConversationRound {
  round: number;
  inputMode: InputMode;
  rawText: string;
  summary: string;
}

export interface ConversationStateData {
  familyId: string;
  childId: string;
  conversationId: string;
  currentRound: number;
  maxRound: number;
  status: 'active' | 'card_generated' | 'archived' | 'abandoned' | 'error';
  firstPrompt: FirstPrompt;
  latestA1?: A1Output;
  understandingCard?: UnderstandingCardData;
  rehearsalResult?: RehearsalResultData;
  adviceCard?: AdviceCardData;
  archiveDraft?: ArchiveDraft;
  cardInsight?: { coreInsight: string; evidenceQuotes: string[]; whatChildProtects?: string };
  rounds: ConversationRound[];
}

export interface StartConversationResponse {
  conversationId: string;
  currentRound: number;
  firstPrompt: FirstPrompt;
}

export interface SubmitProblemAnswerResponse {
  nextAction: 'continue_question' | 'confirm_generate_card' | 'generate_draft_card' | 'safety_stop';
  a1: A1Output;
}

export interface GenerateUnderstandingResponse {
  cardId: string;
  card: UnderstandingCardData;
}

export interface UnderstandingFeedbackResponse {
  updated: boolean;
  cardId: string;
  card?: UnderstandingCardData;
}

export interface GenerateRehearsalResponse {
  rehearsalId: string;
  result: RehearsalResultData;
}

export interface GenerateAdviceResponse {
  adviceId: string;
  card: AdviceCardData;
}

export interface ConfirmArchiveResponse {
  archiveId: string;
  memoryWriteStatus: 'success' | 'failed';
}

export interface RecordChildResponse {
  eventId: string;
  draft: {
    title?: string;
    eventSummary?: string;
    keyObservations?: string[];
    observationNext?: string;
  };
}

export interface ProfileSnapshotCardLink {
  conversationId: string;
  cardId: string;
  title: string;
  version: string;
  preview: string;
  updatedAt?: string;
}

export interface ProfileSnapshotData {
  recentChanges: Array<{ title: string; body: string }>;
  currentFocus: string;
  recentRecords: Array<{ title: string; body: string }>;
  communicationTip: string;
  hasUnreadUpdate: boolean;
  latestUnderstandingCard?: ProfileSnapshotCardLink;
}

export interface AuthUser {
  userId: string;
  phone: string;
  familyId: string;
  childId: string;
}
