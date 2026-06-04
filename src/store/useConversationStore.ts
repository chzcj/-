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
  lastHydratedConversationId?: string;
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
    set((current) => {
      const nextCardId = state.understandingCard?.cardId || current.cardId;
      const nextRehearsalId = state.rehearsalResult?.rehearsalId || current.rehearsalId;
      const nextAdviceId = state.adviceCard?.adviceId || current.adviceId;
      if (
        current.lastHydratedConversationId === state.conversationId &&
        current.currentRound === state.currentRound &&
        current.cardId === nextCardId &&
        current.rehearsalId === nextRehearsalId &&
        current.adviceId === nextAdviceId
      ) {
        return current;
      }
      return {
        state,
        conversationId: state.conversationId,
        currentRound: state.currentRound,
        understandingCard: state.understandingCard || current.understandingCard,
        rehearsalResult: state.rehearsalResult || current.rehearsalResult,
        adviceCard: state.adviceCard || current.adviceCard,
        archiveDraft: state.archiveDraft || current.archiveDraft,
        cardId: nextCardId,
        rehearsalId: nextRehearsalId,
        adviceId: nextAdviceId,
        lastHydratedConversationId: state.conversationId
      };
    }),
  setUnderstandingCard: (understandingCard) => set({ understandingCard, cardId: understandingCard?.cardId }),
  setRehearsalResult: (rehearsalResult) => set({ rehearsalResult, rehearsalId: rehearsalResult?.rehearsalId }),
  setAdviceCard: (adviceCard) => set({ adviceCard, adviceId: adviceCard?.adviceId }),
  setArchiveDraft: (archiveDraft) => set({ archiveDraft })
}));
