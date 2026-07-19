import 'server-only';

import pg from 'pg';
import { formatBeijingDate } from '@/lib/beijing-time';
import type { ArchiveDraft, ConversationStateData, ProfileSnapshotCardLink, ProfileSnapshotData, UnderstandingCardData } from '@/types/childos';

const { Pool } = pg;

type DbGlobal = typeof globalThis & {
  __childosPgPool?: pg.Pool;
  __childosPgSchemaReady?: Promise<void>;
  __childosVectorSchemaReady?: Promise<boolean>;
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
    // 跨进程 DDL 互斥：web 与 jobs worker 同时冷启动会并发执行 CREATE，
    // 撞 pg_type 唯一约束（历史 failed job 元凶）。advisory lock 串行化（会话级，须同一连接）。
    globalDb.__childosPgSchemaReady = (async () => {
      const client = await pool.connect();
      try {
        await client.query(`SELECT pg_advisory_lock(hashtext('childos_schema_ddl'))`);
        await client.query(`
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
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
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

      -- 管理员后台 AI 配置（单行）：key 字段存 AES-GCM 密文，绝不存明文。
      CREATE TABLE IF NOT EXISTS app_settings (
        id INT PRIMARY KEY DEFAULT 1,
        value JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK (id = 1)
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

      CREATE TABLE IF NOT EXISTS family_memory_digests (
        family_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        family_brief JSONB NOT NULL DEFAULT '{}'::jsonb,
        profile_board JSONB NOT NULL DEFAULT '{}'::jsonb,
        brief_version INT NOT NULL DEFAULT 0,
        brief_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
        brief_hash TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (family_id, child_id)
      );

      CREATE TABLE IF NOT EXISTS board_snapshots (
        id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        family_id     TEXT NOT NULL,
        child_id      TEXT NOT NULL,
        version       INT  NOT NULL,
        snapshot      JSONB NOT NULL,
        evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
        content_hash  TEXT NOT NULL,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (family_id, child_id, version),
        UNIQUE (family_id, child_id, content_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_board_latest
        ON board_snapshots (family_id, child_id, version DESC);

      CREATE TABLE IF NOT EXISTS memory_layer_items (
        layer_name TEXT NOT NULL,
        item_id TEXT NOT NULL,
        family_id TEXT NOT NULL DEFAULT 'f_demo',
        child_id TEXT NOT NULL DEFAULT 'c_demo',
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (family_id, child_id, layer_name, item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_memory_layer_items_family_child
        ON memory_layer_items (family_id, child_id, layer_name, updated_at DESC);

      CREATE TABLE IF NOT EXISTS dialogue_analyses (
        analysis_id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL,
        child_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'done',
        summary TEXT NOT NULL DEFAULT '',
        analysis TEXT NOT NULL DEFAULT '',
        try_tonight TEXT NOT NULL DEFAULT '',
        sample_dialogue TEXT NOT NULL DEFAULT '',
        segments JSONB NOT NULL DEFAULT '[]'::jsonb,
        rehearsal_seed JSONB NOT NULL DEFAULT '{}'::jsonb,
        error_message TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_dialogue_analyses_family_child
        ON dialogue_analyses (family_id, child_id, created_at DESC);
    `);
        // 迁移块同样在锁内、同一连接上执行
        await client.query(`
      DO $$ BEGIN
        -- 存量 demo 数据统一到 f_demo/c_demo（记忆域旧值 family_demo/child_demo）
        UPDATE memory_layer_items SET family_id='f_demo' WHERE family_id='family_demo';
        UPDATE memory_layer_items SET child_id='c_demo'  WHERE child_id='child_demo';
        -- entry_evidence_packs 存量裸 itemId 补租户前缀（避免改 PK 后与新写入冲突）
        UPDATE memory_layer_items SET item_id = family_id||':'||child_id||':'||item_id
          WHERE layer_name='entry_evidence_packs' AND item_id LIKE 'entry:%';
        -- 改 PK 加租户（CREATE TABLE IF NOT EXISTS 不会改既有表）
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='memory_layer_items_pkey') THEN
          ALTER TABLE memory_layer_items DROP CONSTRAINT memory_layer_items_pkey;
        END IF;
        ALTER TABLE memory_layer_items ADD PRIMARY KEY (family_id, child_id, layer_name, item_id);
        -- family_memory_digests 补 brief 版本/指纹/证据列（既有库；CREATE IF NOT EXISTS 不改既有表）
        ALTER TABLE family_memory_digests ADD COLUMN IF NOT EXISTS brief_version INT NOT NULL DEFAULT 0;
        ALTER TABLE family_memory_digests ADD COLUMN IF NOT EXISTS brief_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb;
        ALTER TABLE family_memory_digests ADD COLUMN IF NOT EXISTS brief_hash TEXT NOT NULL DEFAULT '';
        -- users 补 is_admin（既有库；CREATE IF NOT EXISTS 不改既有表）
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;
        -- 软删除（注销账号 30 天恢复期）
        ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_openid TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_unionid TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wechat_openid ON users (wechat_openid) WHERE wechat_openid IS NOT NULL;
        -- 已有画像快照或已多次交流的老用户，标记为已完成 onboarding
        UPDATE users u SET onboarding_complete = TRUE
        WHERE onboarding_complete = FALSE AND EXISTS (
          SELECT 1 FROM memory_layer_items m
          WHERE m.family_id = u.family_id AND m.child_id = u.child_id
            AND m.layer_name = 'built_profile_snapshots'
        );
        UPDATE users u SET onboarding_complete = TRUE
        WHERE onboarding_complete = FALSE AND (
          SELECT COUNT(*)::int FROM conversations c
          WHERE c.family_id = u.family_id AND c.child_id = u.child_id
        ) >= 3;
      EXCEPTION WHEN others THEN RAISE NOTICE 'memory_layer_items migration skipped: %', SQLERRM;
      END $$;
    `);
      } finally {
        await client.query(`SELECT pg_advisory_unlock(hashtext('childos_schema_ddl'))`).catch(() => {});
        client.release();
      }
    })();
  }
  await globalDb.__childosPgSchemaReady;
}

/* ================================================================
   向量检索 schema（pgvector）— EvidenceEpisode + FactAtom 两层
   独立 ready 标记，extension/向量列/索引失败时整体降级（resolve false），
   不拖垮主 schema。算子统一余弦（<=> + vector_cosine_ops）。
   ================================================================ */

function toVectorLiteral(v: number[] | null | undefined): string | null {
  return v && v.length > 0 ? `[${v.join(',')}]` : null;
}

async function ensureVectorSchema(): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  await ensureDbSchema();
  if (!globalDb.__childosVectorSchemaReady) {
    globalDb.__childosVectorSchemaReady = (async () => {
      try {
        // 扩展通常由 superuser 预装；普通 DB 用户无 CREATE EXTENSION 权限时仍应继续建表
        try {
          await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
        } catch (extErr) {
          const ext = await pool.query<{ ok: number }>(
            `SELECT 1 AS ok FROM pg_extension WHERE extname = 'vector' LIMIT 1`
          );
          if (!ext.rows.length) throw extErr;
        }
        await pool.query(`
          CREATE TABLE IF NOT EXISTS evidence_episodes (
            episode_id TEXT PRIMARY KEY,
            family_id TEXT NOT NULL DEFAULT 'f_demo',
            child_id TEXT NOT NULL DEFAULT 'c_demo',
            source_event_id TEXT,
            summary TEXT NOT NULL,
            parent_interpretation TEXT,
            missing_info TEXT[] NOT NULL DEFAULT '{}',
            scene_tags TEXT[] NOT NULL DEFAULT '{}',
            mechanism_tags TEXT[] NOT NULL DEFAULT '{}',
            embedding vector(1024),
            source_created_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE TABLE IF NOT EXISTS fact_atoms (
            atom_id TEXT PRIMARY KEY,
            episode_id TEXT NOT NULL,
            family_id TEXT NOT NULL DEFAULT 'f_demo',
            child_id TEXT NOT NULL DEFAULT 'c_demo',
            content TEXT NOT NULL,
            source_type TEXT NOT NULL,
            fact_type TEXT,
            is_high_value BOOLEAN NOT NULL DEFAULT FALSE,
            evidence_strength TEXT NOT NULL DEFAULT 'medium',
            embedding vector(1024),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_episodes_embedding
            ON evidence_episodes USING hnsw (embedding vector_cosine_ops);
          CREATE INDEX IF NOT EXISTS idx_atoms_embedding
            ON fact_atoms USING hnsw (embedding vector_cosine_ops);
          CREATE INDEX IF NOT EXISTS idx_episodes_scene_gin
            ON evidence_episodes USING gin (scene_tags);
          CREATE INDEX IF NOT EXISTS idx_episodes_mech_gin
            ON evidence_episodes USING gin (mechanism_tags);
          CREATE INDEX IF NOT EXISTS idx_atoms_episode ON fact_atoms (episode_id);
          CREATE INDEX IF NOT EXISTS idx_atoms_tenant ON fact_atoms (family_id, child_id);
          CREATE INDEX IF NOT EXISTS idx_episodes_tenant
            ON evidence_episodes (family_id, child_id);
        `);
        return true;
      } catch (error) {
        console.error('[pgvector] schema 初始化失败，向量检索降级到应用层:', error);
        return false;
      }
    })();
  }
  return globalDb.__childosVectorSchemaReady;
}

export async function isPgVectorEnabled(): Promise<boolean> {
  if (!isDatabaseEnabled()) return false;
  return ensureVectorSchema();
}

export interface EpisodeRow {
  episodeId: string;
  familyId?: string;
  childId?: string;
  sourceEventId?: string;
  summary: string;
  parentInterpretation?: string;
  missingInfo?: string[];
  sceneTags?: string[];
  mechanismTags?: string[];
  embedding: number[] | null;
  sourceCreatedAt?: string;
}

export async function upsertEpisodes(rows: EpisodeRow[]): Promise<number | undefined> {
  if (rows.length === 0) return 0;
  if (!(await ensureVectorSchema())) return undefined;
  const pool = getPool();
  if (!pool) return undefined;
  for (const r of rows) {
    await pool.query(
      `INSERT INTO evidence_episodes
         (episode_id, family_id, child_id, source_event_id, summary, parent_interpretation,
          missing_info, scene_tags, mechanism_tags, embedding, source_created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8::text[],$9::text[],$10::vector,$11,NOW())
       ON CONFLICT (episode_id) DO UPDATE SET
         summary=EXCLUDED.summary, parent_interpretation=EXCLUDED.parent_interpretation,
         missing_info=EXCLUDED.missing_info, scene_tags=EXCLUDED.scene_tags,
         mechanism_tags=EXCLUDED.mechanism_tags, embedding=EXCLUDED.embedding,
         source_created_at=EXCLUDED.source_created_at, updated_at=NOW()`,
      [
        r.episodeId, r.familyId || 'f_demo', r.childId || 'c_demo',
        r.sourceEventId || null, r.summary, r.parentInterpretation || null,
        r.missingInfo || [], r.sceneTags || [], r.mechanismTags || [],
        toVectorLiteral(r.embedding), r.sourceCreatedAt || null
      ]
    );
  }
  return rows.length;
}

export interface AtomRow {
  atomId: string;
  episodeId: string;
  familyId?: string;
  childId?: string;
  content: string;
  sourceType: string;
  factType?: string;
  isHighValue: boolean;
  evidenceStrength?: string;
  embedding: number[] | null;
}

export async function upsertAtoms(rows: AtomRow[]): Promise<number | undefined> {
  if (rows.length === 0) return 0;
  if (!(await ensureVectorSchema())) return undefined;
  const pool = getPool();
  if (!pool) return undefined;
  // 多行 INSERT（每块一条），收敛原逐行 N+1。每行 10 列，分块 200 行。
  for (const batch of chunkArray(rows, 200)) {
    const values: unknown[] = [];
    const placeholders = batch.map((r, i) => {
      const b = i * 10;
      values.push(
        r.atomId, r.episodeId, r.familyId || 'f_demo', r.childId || 'c_demo',
        r.content, r.sourceType, r.factType || null, r.isHighValue,
        r.evidenceStrength || 'medium', toVectorLiteral(r.embedding)
      );
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10}::vector)`;
    });
    await pool.query(
      `INSERT INTO fact_atoms
         (atom_id, episode_id, family_id, child_id, content, source_type, fact_type,
          is_high_value, evidence_strength, embedding)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (atom_id) DO UPDATE SET
         content=EXCLUDED.content, source_type=EXCLUDED.source_type, fact_type=EXCLUDED.fact_type,
         is_high_value=EXCLUDED.is_high_value, evidence_strength=EXCLUDED.evidence_strength,
         embedding=EXCLUDED.embedding`,
      values
    );
  }
  return rows.length;
}

// 按租户取最近的高价值 FactAtom（孩子原话 / 材料观察 / 反证 / 执行反馈），供 Brief/Board 重建直接消费原子事实证据。
// 用 idx_atoms_tenant + is_high_value 过滤；DB/向量 schema 不可用或异常时返回 []（不拖垮 digest）。
export async function loadHighValueAtoms(familyId = 'f_demo', childId = 'c_demo', limit = 8): Promise<Array<{ content: string; sourceType: string }>> {
  const pool = getPool();
  if (!pool) return [];
  if (!(await ensureVectorSchema())) return [];
  try {
    const r = await pool.query<{ content: string; source_type: string }>(
      `SELECT content, source_type FROM fact_atoms
       WHERE family_id=$1 AND child_id=$2 AND is_high_value=true
       ORDER BY created_at DESC LIMIT $3`,
      [familyId, childId, limit]
    );
    return r.rows.map(row => ({ content: row.content, sourceType: row.source_type }));
  } catch {
    return [];
  }
}

export interface FactAtomRecord {
  atomId: string;
  episodeId: string;
  content: string;
  sourceType: string;
  factType?: string;
  isHighValue: boolean;
  evidenceStrength: string;
}

// 删除某 Episode 的全部 Atom（Episode 重抽取时先删后插，避免重试留孤儿/重复）。
export async function deleteAtomsByEpisode(episodeId: string): Promise<void> {
  if (!(await ensureVectorSchema())) return;
  const pool = getPool();
  if (!pool) return;
  await pool.query('DELETE FROM fact_atoms WHERE episode_id = $1', [episodeId]);
}

/* ================================================================
   FamilyBrief / BoardSnapshot 持久化（文档 7.5 / 7.6）
   content_hash 驱动幂等：同证据集重跑 → 同 hash → 不增版本。
   ================================================================ */

// 幂等短路用：取最新 board 的 content_hash。
export async function getLatestBoardHash(familyId = 'f_demo', childId = 'c_demo'): Promise<string | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const r = await pool.query<{ content_hash: string }>(
    `SELECT content_hash FROM board_snapshots WHERE family_id=$1 AND child_id=$2 ORDER BY version DESC LIMIT 1`,
    [familyId, childId]
  );
  return r.rows[0]?.content_hash;
}

export interface PersistedBoard {
  snapshot: Record<string, unknown>;
  version: number;
  evidenceRefs: unknown[];
  updatedAt: string;
}

export async function loadLatestBoardSnapshot(familyId = 'f_demo', childId = 'c_demo'): Promise<PersistedBoard | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const r = await pool.query<{ snapshot: Record<string, unknown>; version: number; evidence_refs: unknown[]; updated_at: string | Date }>(
    `SELECT snapshot, version, evidence_refs, updated_at FROM board_snapshots WHERE family_id=$1 AND child_id=$2 ORDER BY version DESC LIMIT 1`,
    [familyId, childId]
  );
  const row = r.rows[0];
  if (!row) return undefined;
  return {
    snapshot: row.snapshot,
    version: row.version,
    evidenceRefs: row.evidence_refs || [],
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date(row.updated_at).toISOString()
  };
}

// version DB 端 max+1；content_hash 命中则 DO NOTHING 不增版本（重试幂等）。
export async function insertBoardSnapshot(familyId: string, childId: string, snapshot: unknown, evidenceRefs: unknown, contentHash: string): Promise<number | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const r = await pool.query<{ version: number }>(
    `INSERT INTO board_snapshots (family_id, child_id, version, snapshot, evidence_refs, content_hash)
     SELECT $1,$2, COALESCE((SELECT max(version) FROM board_snapshots WHERE family_id=$1 AND child_id=$2),0)+1, $3::jsonb,$4::jsonb,$5
     ON CONFLICT (family_id, child_id, content_hash) DO NOTHING
     RETURNING version`,
    [familyId, childId, JSON.stringify(snapshot), JSON.stringify(evidenceRefs), contentHash]
  );
  if (r.rows[0]) return r.rows[0].version;
  const cur = await pool.query<{ version: number }>(
    `SELECT version FROM board_snapshots WHERE family_id=$1 AND child_id=$2 AND content_hash=$3`,
    [familyId, childId, contentHash]
  );
  return cur.rows[0]?.version;
}

// brief_hash 守卫：仅指纹变化才 +1（重试同内容不增版本）。
export async function upsertFamilyBrief(familyId: string, childId: string, brief: unknown, evidenceRefs: unknown, briefHash: string): Promise<number | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const r = await pool.query<{ brief_version: number }>(
    `INSERT INTO family_memory_digests (family_id,child_id,family_brief,brief_version,brief_evidence_refs,brief_hash)
     VALUES ($1,$2,$3::jsonb,1,$4::jsonb,$5)
     ON CONFLICT (family_id,child_id) DO UPDATE
       SET family_brief=EXCLUDED.family_brief,
           brief_evidence_refs=EXCLUDED.brief_evidence_refs,
           brief_hash=EXCLUDED.brief_hash,
           brief_version=family_memory_digests.brief_version+1,
           updated_at=NOW()
       WHERE family_memory_digests.brief_hash IS DISTINCT FROM EXCLUDED.brief_hash
     RETURNING brief_version`,
    [familyId, childId, JSON.stringify(brief), JSON.stringify(evidenceRefs), briefHash]
  );
  if (r.rows[0]) return r.rows[0].brief_version;
  const cur = await pool.query<{ brief_version: number }>(
    `SELECT brief_version FROM family_memory_digests WHERE family_id=$1 AND child_id=$2`,
    [familyId, childId]
  );
  return cur.rows[0]?.brief_version;
}

export async function getCurrentVersions(familyId = 'f_demo', childId = 'c_demo'): Promise<{ briefVersion: number; boardVersion: number }> {
  const pool = getPool();
  if (!pool) return { briefVersion: 0, boardVersion: 0 };
  await ensureDbSchema();
  const b = await pool.query<{ brief_version: number }>(`SELECT brief_version FROM family_memory_digests WHERE family_id=$1 AND child_id=$2`, [familyId, childId]);
  const bd = await pool.query<{ version: number | null }>(`SELECT max(version) AS version FROM board_snapshots WHERE family_id=$1 AND child_id=$2`, [familyId, childId]);
  return { briefVersion: b.rows[0]?.brief_version || 0, boardVersion: bd.rows[0]?.version || 0 };
}

export async function getAtomsByEpisodeIds(
  episodeIds: string[],
  familyId = 'f_demo',
  childId = 'c_demo'
): Promise<FactAtomRecord[] | undefined> {
  if (episodeIds.length === 0) return [];
  if (!(await ensureVectorSchema())) return undefined;
  const pool = getPool();
  if (!pool) return undefined;
  const result = await pool.query<{
    atom_id: string; episode_id: string; content: string;
    source_type: string; fact_type: string | null; is_high_value: boolean; evidence_strength: string;
  }>(
    `SELECT atom_id, episode_id, content, source_type, fact_type, is_high_value, evidence_strength
     FROM fact_atoms
     WHERE episode_id = ANY($1::text[]) AND family_id = $2 AND child_id = $3`,
    [episodeIds, familyId, childId]
  );
  return result.rows.map(row => ({
    atomId: row.atom_id, episodeId: row.episode_id, content: row.content,
    sourceType: row.source_type, factType: row.fact_type || undefined,
    isHighValue: row.is_high_value, evidenceStrength: row.evidence_strength
  }));
}

export interface VectorSearchOpts {
  familyId?: string;
  childId?: string;
  sceneTags?: string[];
  mechanismTags?: string[];
  topK?: number;
}

export interface EpisodeHit {
  episodeId: string;
  summary: string;
  parentInterpretation?: string;
  missingInfo: string[];
  sceneTags: string[];
  mechanismTags: string[];
  sourceCreatedAt?: string;
  distance: number;
}

export async function searchEpisodes(
  queryEmbedding: number[],
  opts: VectorSearchOpts = {}
): Promise<EpisodeHit[] | undefined> {
  if (!queryEmbedding?.length) return undefined;
  if (!(await ensureVectorSchema())) return undefined;
  const pool = getPool();
  if (!pool) return undefined;
  const params: unknown[] = [toVectorLiteral(queryEmbedding), opts.familyId || 'f_demo', opts.childId || 'c_demo'];
  const scene = opts.sceneTags || [];
  const mech = opts.mechanismTags || [];
  let tagClause = '';
  if (scene.length > 0 || mech.length > 0) {
    params.push(scene, mech);
    tagClause = `AND (scene_tags && $${params.length - 1}::text[] OR mechanism_tags && $${params.length}::text[])`;
  }
  params.push(opts.topK || 20);
  const result = await pool.query<{
    episode_id: string; summary: string; parent_interpretation: string | null;
    missing_info: string[]; scene_tags: string[]; mechanism_tags: string[];
    source_created_at: string | null; distance: number;
  }>(
    `SELECT episode_id, summary, parent_interpretation, missing_info, scene_tags, mechanism_tags,
            source_created_at, embedding <=> $1::vector AS distance
     FROM evidence_episodes
     WHERE family_id = $2 AND child_id = $3 AND embedding IS NOT NULL ${tagClause}
     ORDER BY embedding <=> $1::vector
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(row => ({
    episodeId: row.episode_id, summary: row.summary,
    parentInterpretation: row.parent_interpretation || undefined,
    missingInfo: row.missing_info || [], sceneTags: row.scene_tags || [],
    mechanismTags: row.mechanism_tags || [], sourceCreatedAt: row.source_created_at || undefined,
    distance: Number(row.distance)
  }));
}

export interface AtomHit {
  atomId: string;
  episodeId: string;
  content: string;
  sourceType: string;
  factType?: string;
  evidenceStrength: string;
  distance: number;
}

export async function searchHighValueAtoms(
  queryEmbedding: number[],
  opts: VectorSearchOpts = {}
): Promise<AtomHit[] | undefined> {
  if (!queryEmbedding?.length) return undefined;
  if (!(await ensureVectorSchema())) return undefined;
  const pool = getPool();
  if (!pool) return undefined;
  const result = await pool.query<{
    atom_id: string; episode_id: string; content: string; source_type: string;
    fact_type: string | null; evidence_strength: string; distance: number;
  }>(
    `SELECT atom_id, episode_id, content, source_type, fact_type, evidence_strength,
            embedding <=> $1::vector AS distance
     FROM fact_atoms
     WHERE family_id = $2 AND child_id = $3 AND is_high_value = TRUE AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $4`,
    [toVectorLiteral(queryEmbedding), opts.familyId || 'f_demo', opts.childId || 'c_demo', opts.topK || 5]
  );
  return result.rows.map(row => ({
    atomId: row.atom_id, episodeId: row.episode_id, content: row.content,
    sourceType: row.source_type, factType: row.fact_type || undefined,
    evidenceStrength: row.evidence_strength, distance: Number(row.distance)
  }));
}

export interface UserRecord {
  userId: string;
  phone: string;
  passwordHash: string;
  familyId: string;
  childId: string;
  isAdmin: boolean;
  onboardingComplete: boolean;
  wechatOpenid?: string;
  wechatUnionid?: string;
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
    is_admin: boolean;
    onboarding_complete: boolean;
  }>('SELECT user_id, phone, password_hash, family_id, child_id, is_admin, onboarding_complete FROM users WHERE phone = $1', [phone]);
  return mapUser(result.rows[0]);
}

export async function findUserByWechatOpenid(openid: string) {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const result = await pool.query<{
    user_id: string;
    phone: string;
    password_hash: string;
    family_id: string;
    child_id: string;
    is_admin: boolean;
    onboarding_complete: boolean;
    wechat_openid: string | null;
    wechat_unionid: string | null;
  }>(
    `SELECT user_id, phone, password_hash, family_id, child_id, is_admin, onboarding_complete,
            wechat_openid, wechat_unionid
     FROM users WHERE wechat_openid = $1`,
    [openid]
  );
  return mapUser(result.rows[0]);
}

export async function createUserWechat(openid: string, unionid?: string) {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const userId = createId('user');
  const familyId = createId('fam');
  const childId = createId('child');
  const phone = `wx_${openid.slice(-16)}`;
  const result = await pool.query<{
    user_id: string;
    phone: string;
    password_hash: string;
    family_id: string;
    child_id: string;
    is_admin: boolean;
    onboarding_complete: boolean;
    wechat_openid: string | null;
    wechat_unionid: string | null;
  }>(
    `INSERT INTO users (user_id, phone, password_hash, family_id, child_id, wechat_openid, wechat_unionid)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING user_id, phone, password_hash, family_id, child_id, is_admin, onboarding_complete,
               wechat_openid, wechat_unionid`,
    [userId, phone, 'wechat_no_password', familyId, childId, openid, unionid || null]
  );
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
    is_admin: boolean;
    onboarding_complete: boolean;
  }>(
    `INSERT INTO users (user_id, phone, password_hash, family_id, child_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id, phone, password_hash, family_id, child_id, is_admin, onboarding_complete`,
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
    is_admin: boolean;
    onboarding_complete: boolean;
  }>(
    `SELECT u.user_id, u.phone, u.password_hash, u.family_id, u.child_id, u.is_admin, u.onboarding_complete
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

export async function setUserOnboardingComplete(userId: string, complete = true): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureDbSchema();
  await pool.query(
    'UPDATE users SET onboarding_complete = $2, updated_at = NOW() WHERE user_id = $1',
    [userId, complete]
  );
}

/** 更新用户密码哈希（修改密码）。 */
export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureDbSchema();
  await pool.query(
    'UPDATE users SET password_hash = $2, updated_at = NOW() WHERE user_id = $1',
    [userId, passwordHash]
  );
}

/** 软删除账号（注销）：标记 deleted_at，30 天内可恢复。 */
export async function markUserDeleted(userId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureDbSchema();
  await pool.query(
    'UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE user_id = $1',
    [userId]
  );
}

/** 恢复已注销账号（30 天内重新登录时调用）。 */
export async function restoreUser(userId: string): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureDbSchema();
  await pool.query(
    'UPDATE users SET deleted_at = NULL, updated_at = NOW() WHERE user_id = $1',
    [userId]
  );
}

/** 检查账号是否已软删除。 */
export async function isUserDeleted(userId: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) return false;
  await ensureDbSchema();
  const result = await pool.query('SELECT deleted_at FROM users WHERE user_id = $1', [userId]);
  return !!result.rows[0]?.deleted_at;
}

/** 把指定手机号标记/取消管理员（声明式同步 ADMIN_PHONES，幂等）。 */
export async function setUserAdminByPhone(phone: string, isAdmin = true): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureDbSchema();
  await pool.query('UPDATE users SET is_admin = $2, updated_at = NOW() WHERE phone = $1', [phone, isAdmin]);
}

/** 读管理员 AI 配置（单行 app_settings.value，原样返回含密文；解密在 runtime-config 层做）。 */
export async function loadAppSettings(): Promise<Record<string, unknown>> {
  const pool = getPool();
  if (!pool) return {};
  await ensureDbSchema();
  const r = await pool.query<{ value: Record<string, unknown> }>('SELECT value FROM app_settings WHERE id = 1');
  return r.rows[0]?.value || {};
}

/** 覆盖写管理员 AI 配置（单行 upsert）。value 内的 key 字段须已是密文。 */
export async function saveAppSettings(value: Record<string, unknown>): Promise<void> {
  const pool = getPool();
  if (!pool) return;
  await ensureDbSchema();
  await pool.query(
    `INSERT INTO app_settings (id, value, updated_at) VALUES (1, $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(value)]
  );
}

/** 向量层两表计数（admin 业务统计补充；DB/pgvector 未就绪返回 0）。 */
export async function countAtomsAndEpisodes(): Promise<{ factAtoms: number; evidenceEpisodes: number }> {
  const pool = getPool();
  if (!pool || !(await ensureVectorSchema())) return { factAtoms: 0, evidenceEpisodes: 0 };
  try {
    const [a, e] = await Promise.all([
      pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM fact_atoms'),
      pool.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM evidence_episodes')
    ]);
    return { factAtoms: a.rows[0]?.count || 0, evidenceEpisodes: e.rows[0]?.count || 0 };
  } catch {
    return { factAtoms: 0, evidenceEpisodes: 0 };
  }
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
  if (!pool) return { digest: undefined, memories: [], events: [], latestUnderstandingCard: undefined };
  await ensureDbSchema();
  // child_events（写入方已随 record-child 下线，永远为空）与 conversations（旧问题流废弃表）
  // 不再查询；保留返回键以兼容调用方形状。
  const [digest, memories] = await Promise.all([
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
    )
  ]);
  const profileBoard = sanitizeProfileBoardDigest(digest.rows[0]?.profile_board);
  return {
    digest: profileBoard && Object.keys(profileBoard).length > 0 ? profileBoard : undefined,
    memories: memories.rows,
    events: [] as Array<Record<string, unknown>>,
    latestUnderstandingCard: mapLatestUnderstandingCard(undefined)
  };
}

export async function rebuildFamilyMemoryDigest(familyId = 'f_demo', childId = 'c_demo') {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const [memories] = await Promise.all([
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
    )
  ]);

  const now = formatBeijingDate();
  const memoryRows = memories.rows;
  // child_events 表已随 record-child 下线（写入方为零、表待 DROP），legacy digest 不再读它
  const eventRows: Array<{ title: string; event_text: string; change_text: string; worry_text: string; created_at: Date }> = [];
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

export async function loadMemoryLayerItems<T>(layerName: string, familyId = 'f_demo', childId = 'c_demo'): Promise<T[] | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const result = await pool.query<{ data: T }>(
    `SELECT data
     FROM memory_layer_items
     WHERE layer_name = $1 AND family_id = $2 AND child_id = $3
     ORDER BY updated_at ASC`,
    [layerName, familyId, childId]
  );
  return result.rows.map(row => row.data);
}

/** 按 item_id 前缀查 memory_layer_items（如 dossier_v% 历史版本） */
export async function loadMemoryLayerItemsByIdPrefix<T>(
  layerName: string,
  itemIdPrefix: string,
  familyId = 'f_demo',
  childId = 'c_demo'
): Promise<T[] | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const result = await pool.query<{ data: T }>(
    `SELECT data
     FROM memory_layer_items
     WHERE layer_name = $1 AND family_id = $2 AND child_id = $3 AND item_id LIKE $4
     ORDER BY item_id ASC`,
    [layerName, familyId, childId, `${itemIdPrefix}%`]
  );
  return result.rows.map((row) => row.data);
}

// 按 item_id 主键直查单项（PK 命中，O(1)）——审计/按 traceId 取回等场景避免加载整层再 JS 过滤。
export async function loadMemoryLayerItemById<T>(layerName: string, itemId: string, familyId = 'f_demo', childId = 'c_demo'): Promise<T | undefined> {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const result = await pool.query<{ data: T }>(
    `SELECT data FROM memory_layer_items
     WHERE family_id = $1 AND child_id = $2 AND layer_name = $3 AND item_id = $4
     LIMIT 1`,
    [familyId, childId, layerName, itemId]
  );
  return result.rows[0]?.data;
}

// 分块（避免单条 INSERT 超 Postgres 65535 param 上限；同时把 N+1 收敛为每块一条 INSERT）。
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function replaceMemoryLayerItems<T>(
  layerName: string,
  items: Array<{ itemId: string; familyId?: string; childId?: string; data: T }>,
  familyId = 'f_demo',
  childId = 'c_demo'
) {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM memory_layer_items
       WHERE layer_name = $1 AND family_id = $2 AND child_id = $3`,
      [layerName, familyId, childId]
    );
    // 多行 INSERT（每块一条），收敛原逐项 N+1。
    for (const batch of chunkArray(items, 500)) {
      const values: unknown[] = [];
      const rows = batch.map((item, i) => {
        const b = i * 5;
        values.push(layerName, item.itemId, item.familyId || familyId, item.childId || childId, JSON.stringify(item.data));
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::jsonb)`;
      });
      await client.query(
        `INSERT INTO memory_layer_items (layer_name, item_id, family_id, child_id, data)
         VALUES ${rows.join(', ')}
         ON CONFLICT (family_id, child_id, layer_name, item_id)
         DO UPDATE SET family_id = EXCLUDED.family_id,
                       child_id = EXCLUDED.child_id,
                       data = EXCLUDED.data,
                       updated_at = NOW()`,
        values
      );
    }
    await client.query('COMMIT');
    return items.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertMemoryLayerItems<T>(
  layerName: string,
  items: Array<{ itemId: string; familyId?: string; childId?: string; data: T }>,
  familyId = 'f_demo',
  childId = 'c_demo'
) {
  const pool = getPool();
  if (!pool) return undefined;
  if (items.length === 0) return 0;
  await ensureDbSchema();
  // 多行 INSERT（每块一条），收敛原逐项 N+1。每行 5 列，分块 500 行（远低于 param 上限）。
  for (const batch of chunkArray(items, 500)) {
    const values: unknown[] = [];
    const rows = batch.map((item, i) => {
      const b = i * 5;
      values.push(layerName, item.itemId, item.familyId || familyId, item.childId || childId, JSON.stringify(item.data));
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::jsonb)`;
    });
    await pool.query(
      `INSERT INTO memory_layer_items (layer_name, item_id, family_id, child_id, data)
       VALUES ${rows.join(', ')}
       ON CONFLICT (family_id, child_id, layer_name, item_id)
       DO UPDATE SET family_id = EXCLUDED.family_id,
                     child_id = EXCLUDED.child_id,
                     data = EXCLUDED.data,
                     updated_at = NOW()`,
      values
    );
  }
  return items.length;
}

export async function debugMemoryLayerItemCounts() {
  const pool = getPool();
  if (!pool) return undefined;
  await ensureDbSchema();
  const result = await pool.query<{ layer_name: string; count: number }>(
    `SELECT layer_name, COUNT(*)::int AS count
     FROM memory_layer_items
     GROUP BY layer_name`
  );
  return Object.fromEntries(result.rows.map(row => [row.layer_name, row.count]));
}

export async function debugDatabase() {
  const pool = getPool();
  if (!pool) return { enabled: false };
  await ensureDbSchema();
  // 只统计活跃表：conversations/archives/child_events 属已下线功能（备份后待 DROP），
  // readiness 不再依赖它们，DROP 后此端点不受影响。
  const [memories, digests, layerItems, episodes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM memory_records'),
    pool.query('SELECT COUNT(*)::int AS count FROM family_memory_digests'),
    pool.query('SELECT COUNT(*)::int AS count FROM memory_layer_items'),
    pool.query("SELECT COUNT(*)::int AS count FROM evidence_episodes").catch(() => ({ rows: [{ count: 0 }] }))
  ]);
  const users = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  return {
    enabled: true,
    users: users.rows[0]?.count || 0,
    memoryRecords: memories.rows[0]?.count || 0,
    familyMemoryDigests: digests.rows[0]?.count || 0,
    memoryLayerItems: layerItems.rows[0]?.count || 0,
    evidenceEpisodes: episodes.rows[0]?.count || 0
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

function mapLatestUnderstandingCard(row?: {
  conversation_id: string;
  updated_at: Date;
  understanding_card: UnderstandingCardData | null;
}): ProfileSnapshotCardLink | undefined {
  const card = row?.understanding_card;
  if (!row || !card?.cardId) return undefined;
  const firstSection = card.sections.find((section) => Boolean(section.body))?.body;
  const preview = Array.isArray(firstSection) ? firstSection.join('；') : firstSection || '';
  return {
    conversationId: row.conversation_id,
    cardId: card.cardId,
    title: card.title || '最近理解卡',
    version: card.version || 'v1',
    preview: frontText(preview, 88),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : undefined
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
  is_admin?: boolean;
  onboarding_complete?: boolean;
  wechat_openid?: string | null;
  wechat_unionid?: string | null;
}): UserRecord | undefined {
  if (!row) return undefined;
  return {
    userId: row.user_id,
    phone: row.phone,
    passwordHash: row.password_hash,
    familyId: row.family_id,
    childId: row.child_id,
    isAdmin: row.is_admin === true,
    onboardingComplete: row.onboarding_complete === true,
    wechatOpenid: row.wechat_openid || undefined,
    wechatUnionid: row.wechat_unionid || undefined,
  };
}

export type DialogueAnalysisRecord = {
  analysisId: string
  familyId: string
  childId: string
  status: string
  summary: string
  analysis: string
  tryTonight: string
  sampleDialogue: string
  segments: Array<{ speaker: string; text: string; highlight?: boolean; highlightReason?: string }>
  rehearsalSeed: Record<string, unknown>
  errorMessage: string
  createdAt?: string
  updatedAt?: string
}

export async function upsertDialogueAnalysis(row: DialogueAnalysisRecord): Promise<void> {
  const pool = getPool()
  if (!pool) return
  await ensureDbSchema()
  await pool.query(
    `INSERT INTO dialogue_analyses (
      analysis_id, family_id, child_id, status, summary, analysis, try_tonight,
      sample_dialogue, segments, rehearsal_seed, error_message, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,NOW())
    ON CONFLICT (analysis_id) DO UPDATE SET
      status = EXCLUDED.status,
      summary = EXCLUDED.summary,
      analysis = EXCLUDED.analysis,
      try_tonight = EXCLUDED.try_tonight,
      sample_dialogue = EXCLUDED.sample_dialogue,
      segments = EXCLUDED.segments,
      rehearsal_seed = EXCLUDED.rehearsal_seed,
      error_message = EXCLUDED.error_message,
      updated_at = NOW()`,
    [
      row.analysisId,
      row.familyId,
      row.childId,
      row.status,
      row.summary,
      row.analysis,
      row.tryTonight,
      row.sampleDialogue,
      JSON.stringify(row.segments || []),
      JSON.stringify(row.rehearsalSeed || {}),
      row.errorMessage || '',
    ]
  )
}

export async function loadDialogueAnalysis(
  analysisId: string
): Promise<DialogueAnalysisRecord | undefined> {
  const pool = getPool()
  if (!pool) return undefined
  await ensureDbSchema()
  const result = await pool.query(
    `SELECT analysis_id, family_id, child_id, status, summary, analysis, try_tonight,
            sample_dialogue, segments, rehearsal_seed, error_message, created_at, updated_at
     FROM dialogue_analyses WHERE analysis_id = $1`,
    [analysisId]
  )
  const r = result.rows[0]
  if (!r) return undefined
  return {
    analysisId: r.analysis_id,
    familyId: r.family_id,
    childId: r.child_id,
    status: r.status,
    summary: r.summary || '',
    analysis: r.analysis || '',
    tryTonight: r.try_tonight || '',
    sampleDialogue: r.sample_dialogue || '',
    segments: Array.isArray(r.segments) ? r.segments : [],
    rehearsalSeed: r.rehearsal_seed && typeof r.rehearsal_seed === 'object' ? r.rehearsal_seed : {},
    errorMessage: r.error_message || '',
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : undefined,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : undefined,
  }
}

