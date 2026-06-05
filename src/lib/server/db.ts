import 'server-only';

import pg from 'pg';
import type { ArchiveDraft, ConversationStateData, ProfileSnapshotData } from '@/types/childos';

const { Pool } = pg;

type DbGlobal = typeof globalThis & {
  __childosPgPool?: pg.Pool;
  __childosPgSchemaReady?: Promise<void>;
};

const globalDb = globalThis as DbGlobal;

export function isDatabaseEnabled() {
  return Boolean(process.env.DATABASE_URL?.startsWith('postgres')) && process.env.NEXT_PUBLIC_USE_MOCK === 'false';
}

function getPool() {
  if (!isDatabaseEnabled()) return undefined;
  if (!globalDb.__childosPgPool) {
    globalDb.__childosPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: 30_000
    });
  }
  return globalDb.__childosPgPool;
}

export async function ensureDbSchema() {
  const pool = getPool();
  if (!pool) return;
  if (!globalDb.__childosPgSchemaReady) {
    globalDb.__childosPgSchemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        conversation_id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        status TEXT NOT NULL,
        state JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        family_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS archives (
        archive_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS memory_records (
        memory_id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        conversation_id TEXT,
        archive_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        evidence TEXT,
        confidence TEXT,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS child_events (
        event_id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        title TEXT NOT NULL,
        event_text TEXT NOT NULL,
        change_text TEXT NOT NULL DEFAULT '',
        worry_text TEXT NOT NULL DEFAULT '',
        draft JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS family_memory_digests (
        family_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        family_brief JSONB NOT NULL DEFAULT '{}'::jsonb,
        profile_board JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (family_id, child_id)
      );
    `).then(() => undefined);
  }
  await globalDb.__childosPgSchemaReady;
}

export interface UserRecord {
  userId: string;
  phone: string;
  passwordHash: string;
  familyId: string;
  childId: string;
}

export async function findUserByPhone(phone: string) {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const result = await pool.query<{
    user_id: string;
    phone: string;
    password_hash: string;
    family_id: string;
    child_id: string;
  }>('SELECT user_id, phone, password_hash, family_id, child_id FROM users WHERE phone = $1', [phone]);
  return mapUser(result.rows[0]);
}

export async function createUser(phone: string, passwordHash: string) {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const userId = createId('user');
  const familyId = createId('fam');
  const childId = createId('child');
  const result = await pool.query<{
    user_id: string;
    phone: string;
    password_hash: string;
    family_id: string;
    child_id: string;
  }>(
    `INSERT INTO users (user_id, phone, password_hash, family_id, child_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id, phone, password_hash, family_id, child_id`,
    [userId, phone, passwordHash, familyId, childId]
  );
  return mapUser(result.rows[0]);
}

export async function createAuthSession(userId: string, tokenHash: string, expiresAt: Date) {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const sessionId = createId('sess');
  await pool.query(
    `INSERT INTO auth_sessions (session_id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [sessionId, userId, tokenHash, expiresAt.toISOString()]
  );
  return sessionId;
}

export async function findUserBySessionTokenHash(tokenHash: string) {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  await pool.query('DELETE FROM auth_sessions WHERE expires_at < NOW()');
  const result = await pool.query<{
    user_id: string;
    phone: string;
    password_hash: string;
    family_id: string;
    child_id: string;
  }>(
    `SELECT u.user_id, u.phone, u.password_hash, u.family_id, u.child_id
     FROM auth_sessions s
     JOIN users u ON u.user_id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash]
  );
  return mapUser(result.rows[0]);
}

export async function deleteAuthSession(tokenHash: string) {
  const pool = getPool();
  if (!pool) return;
  await ensureDbSchema();
  await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
}

export async function saveConversationState(conversation: ConversationStateData) {
  const pool = getPool();
  if (!pool) return;
  await ensureDbSchema();
  await pool.query(
    `INSERT INTO conversations (conversation_id, family_id, child_id, status, state)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (conversation_id)
     DO UPDATE SET family_id = EXCLUDED.family_id,
                   child_id = EXCLUDED.child_id,
                   status = EXCLUDED.status,
                   state = EXCLUDED.state,
                   updated_at = NOW()`,
    [conversation.conversationId, conversation.familyId, conversation.childId, conversation.status, JSON.stringify(conversation)]
  );
}

export async function loadConversationState(conversationId: string) {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const result = await pool.query<{ state: ConversationStateData }>('SELECT state FROM conversations WHERE conversation_id = $1', [conversationId]);
  return result.rows[0]?.state;
}

export async function saveArchiveDraft(archive: ArchiveDraft) {
  const pool = getPool();
  if (!pool) return;
  await ensureDbSchema();
  await pool.query(
    `INSERT INTO archives (archive_id, conversation_id, data)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (archive_id)
     DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [archive.archiveId, archive.conversationId, JSON.stringify(archive)]
  );
}

export interface MemoryRecordInput {
  familyId: string;
  childId: string;
  conversationId?: string;
  archiveId?: string;
  type: string;
  title: string;
  content: string;
  evidence?: string;
  confidence?: string;
  tags?: string[];
}

export interface FamilyBriefMemory {
  recentFocus: string;
  activeHypotheses: string[];
  stableProfiles: string[];
  interactionPatterns: string[];
  avoidAssumptions: string[];
  nextVerify: string;
  updatedAt: string;
}

export interface ProfileBoardDigest extends ProfileSnapshotData {
  updatedAt?: string;
}

export async function insertMemoryRecords(records: MemoryRecordInput[]) {
  const pool = getPool();
  if (!pool || records.length === 0) return 0;
  await ensureDbSchema();
  for (const record of records) {
    await pool.query(
      `INSERT INTO memory_records
       (memory_id, family_id, child_id, conversation_id, archive_id, type, title, content, evidence, confidence, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       ON CONFLICT (memory_id) DO NOTHING`,
      [
        createId('mem'),
        record.familyId,
        record.childId,
        record.conversationId || null,
        record.archiveId || null,
        record.type,
        record.title,
        record.content,
        record.evidence || null,
        record.confidence || null,
        JSON.stringify(record.tags || [])
      ]
    );
  }
  return records.length;
}

export async function saveChildEvent(input: {
  familyId: string;
  childId: string;
  title: string;
  eventText: string;
  changeText?: string;
  worryText?: string;
  draft?: unknown;
}) {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const eventId = createId('evt');
  await pool.query(
    `INSERT INTO child_events (event_id, family_id, child_id, title, event_text, change_text, worry_text, draft)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      eventId,
      input.familyId,
      input.childId,
      input.title,
      input.eventText,
      input.changeText || '',
      input.worryText || '',
      JSON.stringify(input.draft || null)
    ]
  );
  return eventId;
}

export async function loadRecentContext(familyId = 'f_demo', childId = 'c_demo') {
  const pool = getPool();
  if (!pool) return { memories: [], events: [] };
  await ensureDbSchema();
  const memories = await pool.query(
    `SELECT type, title, content, evidence, confidence, tags, created_at
     FROM memory_records
     WHERE family_id = $1 AND child_id = $2
     ORDER BY created_at DESC
     LIMIT 20`,
    [familyId, childId]
  );
  const events = await pool.query(
    `SELECT title, event_text, change_text, worry_text, draft, created_at
     FROM child_events
     WHERE family_id = $1 AND child_id = $2
     ORDER BY created_at DESC
     LIMIT 10`,
    [familyId, childId]
  );
  return { memories: memories.rows, events: events.rows };
}

export async function loadFamilyBriefMemory(familyId = 'f_demo', childId = 'c_demo'): Promise<FamilyBriefMemory | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const result = await pool.query<{ family_brief: FamilyBriefMemory }>(
    `SELECT family_brief
     FROM family_memory_digests
     WHERE family_id = $1 AND child_id = $2`,
    [familyId, childId]
  );
  const brief = result.rows[0]?.family_brief;
  return brief && Object.keys(brief).length > 0 ? brief : undefined;
}

export async function loadProfileSnapshotContext(familyId = 'f_demo', childId = 'c_demo') {
  const pool = getPool();
  if (!pool) return { digest: undefined, memories: [], events: [] };
  await ensureDbSchema();
  const [digest, memories, events] = await Promise.all([
    pool.query<{ profile_board: ProfileBoardDigest }>(
      `SELECT profile_board
       FROM family_memory_digests
       WHERE family_id = $1 AND child_id = $2`,
      [familyId, childId]
    ),
    pool.query(
      `SELECT type, title, LEFT(content, 140) AS content, LEFT(COALESCE(evidence, ''), 90) AS evidence, created_at
       FROM memory_records
       WHERE family_id = $1 AND child_id = $2
       ORDER BY created_at DESC
       LIMIT 6`,
      [familyId, childId]
    ),
    pool.query(
      `SELECT title, LEFT(event_text, 140) AS event_text, LEFT(change_text, 100) AS change_text, LEFT(worry_text, 100) AS worry_text, created_at
       FROM child_events
       WHERE family_id = $1 AND child_id = $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [familyId, childId]
    )
  ]);
  const profileBoard = sanitizeProfileBoardDigest(digest.rows[0]?.profile_board);
  return {
    digest: profileBoard && Object.keys(profileBoard).length > 0 ? profileBoard : undefined,
    memories: memories.rows,
    events: events.rows
  };
}

export async function rebuildFamilyMemoryDigest(familyId = 'f_demo', childId = 'c_demo') {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const [memories, events] = await Promise.all([
    pool.query<{
      type: string;
      title: string;
      content: string;
      evidence: string | null;
      confidence: string | null;
      created_at: Date;
    }>(
      `SELECT type, title, content, evidence, confidence, created_at
       FROM memory_records
       WHERE family_id = $1 AND child_id = $2
       ORDER BY created_at DESC
       LIMIT 12`,
      [familyId, childId]
    ),
    pool.query<{
      title: string;
      event_text: string;
      change_text: string;
      worry_text: string;
      created_at: Date;
    }>(
      `SELECT title, event_text, change_text, worry_text, created_at
       FROM child_events
       WHERE family_id = $1 AND child_id = $2
       ORDER BY created_at DESC
       LIMIT 8`,
      [familyId, childId]
    )
  ]);

  const now = new Date().toISOString();
  const memoryRows = memories.rows;
  const eventRows = events.rows;
  const pendingRows = memoryRows.filter((row) => /pending|hypothesis|线索/i.test(row.type));
  const stableRows = memoryRows.filter((row) => /stable|profile/i.test(row.type));
  const rawRows = memoryRows.filter((row) => /raw|event|record/i.test(row.type));
  const recentSource = [...pendingRows, ...rawRows, ...memoryRows];
  const recentFocus = clip(
    recentSource
      .slice(0, 2)
      .map((row) => row.content || row.title)
      .filter(Boolean)
      .join('；') || eventRows[0]?.event_text || '',
    110
  );

  const familyBrief: FamilyBriefMemory = {
    recentFocus,
    activeHypotheses: uniqueShort(pendingRows.map((row) => row.content || row.title), 5, 56),
    stableProfiles: uniqueShort(stableRows.map((row) => row.content || row.title), 4, 64),
    interactionPatterns: uniqueShort(memoryRows.filter((row) => /support|family|interaction|conflict|沟通|冲突/i.test(`${row.type} ${row.title}`)).map((row) => row.content), 4, 64),
    avoidAssumptions: ['不要直接采信“懒、沉迷、不自觉”等评价词', '单次事件只能当线索，不能写成稳定画像'],
    nextVerify: clip(pendingRows[0]?.evidence || pendingRows[0]?.content || '下次优先确认行为发生在开始前、过程中，还是被检查/催促之后。', 80),
    updatedAt: now
  };

  const recentChanges = uniqueShort(recentSource.map((row) => frontText(row.content || row.title, 72)), 3, 72).map((body, index) => ({
    title: index === 0 ? '最近值得关注的变化' : `近期线索 ${index + 1}`,
    body
  }));
  const recentRecords = eventRows.slice(0, 5).map((row) => ({
    title: clip(row.title || row.event_text, 24),
    body: clip([row.event_text, row.change_text, row.worry_text].filter(Boolean).join('；'), 90)
  }));
  const profileBoard: ProfileBoardDigest = {
    recentChanges,
    currentFocus: frontText(familyBrief.recentFocus || familyBrief.nextVerify, 110),
    recentRecords,
    communicationTip: frontText(memoryRows.find((row) => /support|advice|沟通|建议/i.test(`${row.type} ${row.title}`))?.content || '', 80),
    hasUnreadUpdate: recentChanges.length > 0 || recentRecords.length > 0,
    updatedAt: now
  };

  await pool.query(
    `INSERT INTO family_memory_digests (family_id, child_id, family_brief, profile_board, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW())
     ON CONFLICT (family_id, child_id)
     DO UPDATE SET family_brief = EXCLUDED.family_brief,
                   profile_board = EXCLUDED.profile_board,
                   updated_at = NOW()`,
    [familyId, childId, JSON.stringify(familyBrief), JSON.stringify(profileBoard)]
  );
  return { familyBrief, profileBoard };
}

export async function debugDatabase() {
  const pool = getPool();
  if (!pool) return { enabled: false };
  await ensureDbSchema();
  const [conversations, archives, memories, events, digests] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM conversations'),
    pool.query('SELECT COUNT(*)::int AS count FROM archives'),
    pool.query('SELECT COUNT(*)::int AS count FROM memory_records'),
    pool.query('SELECT COUNT(*)::int AS count FROM child_events'),
    pool.query('SELECT COUNT(*)::int AS count FROM family_memory_digests')
  ]);
  const users = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  return {
    enabled: true,
    users: users.rows[0]?.count || 0,
    conversations: conversations.rows[0]?.count || 0,
    archives: archives.rows[0]?.count || 0,
    memoryRecords: memories.rows[0]?.count || 0,
    childEvents: events.rows[0]?.count || 0,
    familyMemoryDigests: digests.rows[0]?.count || 0
  };
}

function uniqueShort(values: Array<string | null | undefined>, limit: number, maxLength: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const item = clip(value || '', maxLength);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function clip(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function frontText(value: string, maxLength: number) {
  const text = value
    .replace(/当前未验证假设[:：]?/g, '')
    .replace(/未验证假设[:：]?/g, '')
    .replace(/沟通优化方案[:：]?/g, '')
    .replace(/干预话术建议[:：]?/g, '')
    .replace(/后续观察项[:：]?/g, '')
    .replace(/恶性循环/g, '循环')
    .replace(/焦虑情绪/g, '压力感')
    .replace(/作业焦虑/g, '作业压力')
    .replace(/置信度[:：]?(low|medium|high|低|中|高)?/gi, '')
    .replace(/证据数[:：]?\d*/g, '')
    .replace(/\b\d+[.、]\s*/g, '')
    .replace(/；\s*\d+[.、]\s*/g, '；')
    .trim();
  return clip(text, maxLength);
}

function sanitizeProfileBoardDigest(digest?: ProfileBoardDigest) {
  if (!digest) return undefined;
  return {
    ...digest,
    recentChanges: Array.isArray(digest.recentChanges)
      ? digest.recentChanges.map((item) => ({
          title: frontText(item.title || '', 28),
          body: frontText(item.body || '', 90)
        }))
      : [],
    currentFocus: frontText(digest.currentFocus || '', 120),
    recentRecords: Array.isArray(digest.recentRecords)
      ? digest.recentRecords.map((item) => ({
          title: frontText(item.title || '', 28),
          body: frontText(item.body || '', 90)
        }))
      : [],
    communicationTip: frontText(digest.communicationTip || '', 90),
    hasUnreadUpdate: Boolean(digest.hasUnreadUpdate)
  };
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mapUser(row?: {
  user_id: string;
  phone: string;
  password_hash: string;
  family_id: string;
  child_id: string;
}): UserRecord | undefined {
  if (!row) return undefined;
  return {
    userId: row.user_id,
    phone: row.phone,
    passwordHash: row.password_hash,
    familyId: row.family_id,
    childId: row.child_id
  };
}
