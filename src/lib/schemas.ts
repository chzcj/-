import { z } from 'zod';

export const startConversationSchema = z.object({
  familyId: z.string().min(1).default('f_demo'),
  childId: z.string().min(1).default('c_demo'),
  entry: z.literal('problem').default('problem')
});

export const problemAnswerSchema = z.object({
  conversationId: z.string().min(1),
  round: z.number().int().min(1).max(8),
  inputMode: z.enum(['voice', 'text']).default('text'),
  text: z.string().trim().min(1).max(2000)
});

export const understandingGenerateSchema = z.object({
  conversationId: z.string().min(1)
});

export const understandingFeedbackSchema = z.object({
  conversationId: z.string().min(1),
  cardId: z.string().min(1),
  feedbackType: z.enum(['accurate', 'partially_inaccurate', 'edit', 'add_detail']),
  text: z.string().trim().max(2000).optional().default('')
});

export const rehearsalAnalyzeSchema = z.object({
  conversationId: z.string().min(1),
  cardId: z.string().min(1),
  parentText: z.string().trim().min(1).max(300)
});

export const adviceGenerateSchema = z.object({
  conversationId: z.string().min(1),
  cardId: z.string().min(1)
});

export const archiveDraftQuerySchema = z.object({
  conversationId: z.string().min(1),
  cardId: z.string().optional(),
  rehearsalId: z.string().optional(),
  adviceId: z.string().optional()
});

export const archiveConfirmSchema = z.object({
  conversationId: z.string().min(1),
  archive: z.object({
    archiveId: z.string().min(1),
    date: z.string().min(1).max(100),
    eventSummary: z.string().min(1).max(800),
    conflictPoint: z.string().min(1).max(800),
    currentClues: z.string().min(1).max(800),
    rehearsalOrAdvice: z.string().max(800).optional(),
    observationNext: z.string().min(1).max(800)
  })
});
