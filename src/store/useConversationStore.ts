'use client';

import { create } from 'zustand';
import type {
  AdviceCardData,
  ArchiveDraft,
  ConversationStateData,
  RehearsalResultData,
  UnderstandingCardData
} from '@/types/childos';

interface ConversationStore {
  conversationId?: string;
  cardId?: string;
  rehearsalId?: string;
  adviceId?: string;
  currentRound: number;
  state?: ConversationStateData;
  understandingCard?: UnderstandingCardData;
  rehearsalResult?: RehearsalResultData;
  adviceCard?: AdviceCardData;
  archiveDraft?: ArchiveDraft;
  setConversationId: (conversationId?: string) => void;
  setCardId: (cardId?: string) => void;
  setRehearsalId: (rehearsalId?: string) => void;
  setAdviceId: (adviceId?: string) => void;
  setCurrentRound: (round: number) => void;
  hydrateState: (state: ConversationStateData) => void;
  setUnderstandingCard: (card?: UnderstandingCardData) => void;
  setRehearsalResult: (result?: RehearsalResultData) => void;
  setAdviceCard: (card?: AdviceCardData) => void;
  setArchiveDraft: (draft?: ArchiveDraft) => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  currentRound: 1,
  setConversationId: (conversationId) => set({ conversationId }),
  setCardId: (cardId) => set({ cardId }),
  setRehearsalId: (rehearsalId) => set({ rehearsalId }),
  setAdviceId: (adviceId) => set({ adviceId }),
  setCurrentRound: (currentRound) => set({ currentRound }),
  hydrateState: (state) =>
    set({
      state,
      conversationId: state.conversationId,
      currentRound: state.currentRound,
      understandingCard: state.understandingCard,
      rehearsalResult: state.rehearsalResult,
      adviceCard: state.adviceCard,
      archiveDraft: state.archiveDraft,
      cardId: state.understandingCard?.cardId
    }),
  setUnderstandingCard: (understandingCard) => set({ understandingCard, cardId: understandingCard?.cardId }),
  setRehearsalResult: (rehearsalResult) => set({ rehearsalResult, rehearsalId: rehearsalResult?.rehearsalId }),
  setAdviceCard: (adviceCard) => set({ adviceCard, adviceId: adviceCard?.adviceId }),
  setArchiveDraft: (archiveDraft) => set({ archiveDraft })
}));
