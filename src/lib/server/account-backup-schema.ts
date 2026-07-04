import { z } from 'zod'

/** 单用户客户端备份总字节上限（JSON 序列化后） */
export const ACCOUNT_BACKUP_MAX_BYTES = 512 * 1024

const MAX_TEXT = 8000
const MAX_SHORT = 512
const MAX_ID = 128
const MAX_ARRAY = 80

const trimmedString = (max: number) => z.string().max(max)

const localFamilySchema = z
  .object({
    familyId: trimmedString(MAX_ID),
    name: trimmedString(MAX_SHORT).optional(),
    createdAt: trimmedString(64).optional(),
  })
  .passthrough()

const localChildSchema = z
  .object({
    childId: trimmedString(MAX_ID),
    familyId: trimmedString(MAX_ID),
    name: trimmedString(MAX_SHORT).optional(),
    ageBand: trimmedString(32).optional(),
    createdAt: trimmedString(64).optional(),
  })
  .passthrough()

const textRecordSchema = z.record(z.unknown()).transform((row) => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string') out[k] = v.slice(0, MAX_TEXT)
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v
    else if (Array.isArray(v)) out[k] = v.slice(0, MAX_ARRAY)
    else if (typeof v === 'object' && v) out[k] = v
  }
  return out
})

const accountStorageSchema = z.object({
  version: z.literal('childos.storage.v1'),
  activeFamilyId: trimmedString(MAX_ID),
  activeChildId: trimmedString(MAX_ID),
  families: z.array(localFamilySchema).max(MAX_ARRAY).default([]),
  children: z.array(localChildSchema).max(MAX_ARRAY).default([]),
  buildSessions: z.array(textRecordSchema).max(MAX_ARRAY).default([]),
  entryRecords: z.array(textRecordSchema).max(MAX_ARRAY).default([]),
  followUpRecords: z.array(textRecordSchema).max(MAX_ARRAY).default([]),
  stageSummaries: z.array(textRecordSchema).max(MAX_ARRAY).default([]),
  profileSnapshots: z.array(textRecordSchema).max(24).default([]),
  evidenceRecords: z.array(textRecordSchema).max(MAX_ARRAY).default([]),
  verificationPoints: z.array(textRecordSchema).max(MAX_ARRAY).default([]),
  dailyObservations: z.array(textRecordSchema).max(MAX_ARRAY).default([]),
  updatedAt: trimmedString(64).optional(),
})

const dailySectionSchema = z.object({
  id: trimmedString(MAX_ID),
  label: trimmedString(MAX_SHORT),
  kind: z.enum(['paragraphs', 'list', 'quotes', 'mixed']),
  paragraphs: z.array(trimmedString(MAX_TEXT)).max(12).optional(),
  items: z.array(trimmedString(MAX_TEXT)).max(12).optional(),
  quotes: z.array(trimmedString(MAX_TEXT)).max(8).optional(),
  note: trimmedString(MAX_TEXT).optional(),
  hidden: z.boolean().optional(),
})

const dailyActionSchema = z.object({
  id: trimmedString(MAX_ID),
  label: trimmedString(MAX_SHORT),
  kind: z.enum(['expand_sections', 'rehearsal', 'how_to_speak', 'task', 'follow_up_text', 'navigate']),
  primary: z.boolean().optional(),
  payload: z
    .object({
      sectionIds: z.array(trimmedString(MAX_ID)).max(8).optional(),
      route: trimmedString(256).optional(),
      seedText: trimmedString(MAX_TEXT).optional(),
    })
    .optional(),
})

const dailyTurnSchema = z.object({
  role: z.enum(['parent', 'ai']),
  text: trimmedString(MAX_TEXT),
  traceId: trimmedString(MAX_ID).optional(),
  cards: z.unknown().optional(),
  linkedAreas: z.array(trimmedString(64)).max(12).optional(),
  sections: z.array(dailySectionSchema).max(12).optional(),
  actions: z.array(dailyActionSchema).max(8).optional(),
})

export const accountBackupBodySchema = z.object({
  dailyThread: z.array(dailyTurnSchema).max(40).default([]),
  storage: accountStorageSchema.nullable().optional(),
})

export type ParsedAccountBackupBody = z.infer<typeof accountBackupBodySchema>

export function parseAccountBackupBody(raw: unknown): ParsedAccountBackupBody {
  const byteSize =
    typeof raw === 'string'
      ? Buffer.byteLength(raw, 'utf8')
      : Buffer.byteLength(JSON.stringify(raw ?? {}), 'utf8')
  if (byteSize > ACCOUNT_BACKUP_MAX_BYTES) {
    throw new Error('BACKUP_TOO_LARGE')
  }
  return accountBackupBodySchema.parse(raw)
}
