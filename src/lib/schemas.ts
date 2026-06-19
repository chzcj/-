import { z } from 'zod';
import { DEFAULT_MAX_ROUND } from '@/lib/conversation-config';

export const startConversationSchema = z.object({
  familyId: z.string().min(1).default('f_demo'),
  childId: z.string().min(1).default('c_demo'),
  entry: z.literal('problem').default('problem')
});

export const problemAnswerSchema = z.object({
  conversationId: z.string().min(1),
  round: z.number().int().min(1).max(DEFAULT_MAX_ROUND),
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

export const recordChildSchema = z.object({
  familyId: z.string().min(1).default('f_demo'),
  childId: z.string().min(1).default('c_demo'),
  eventText: z.string().trim().max(2000).default(''),
  changeText: z.string().trim().max(1200).default(''),
  worryText: z.string().trim().max(1200).default('')
}).refine((data) => Boolean(data.eventText || data.changeText || data.worryText), {
  message: 'EMPTY_RECORD'
});

// 材料理解：家长贴入材料文本（老师反馈/作业/录音转写/截图文字）。
// familyId/childId 仅占位，路由用 resolveTenant() 覆盖，杜绝 body 越权。
export const materialUnderstandingSchema = z.object({
  familyId: z.string().min(1).default('f_demo'),
  childId: z.string().min(1).default('c_demo'),
  materialText: z.string().trim().min(1).max(4000),
  materialType: z.enum(['teacher_feedback', 'homework', 'transcript', 'screenshot_text', 'other']).default('other')
});

export const profileSnapshotQuerySchema = z.object({
  familyId: z.string().min(1).default('f_demo'),
  childId: z.string().min(1).default('c_demo')
});

export const authCredentialsSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  password: z.string().min(8).max(72)
});
