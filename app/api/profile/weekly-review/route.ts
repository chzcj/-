import { fail, ok } from '@/lib/api-response';
import { getRequestIdentity } from '@/lib/server/auth';
import { isDatabaseEnabled } from '@/lib/server/db';
import { callAgentJson } from '@/lib/server/ark-agents';
import { verifyAppApi, authError } from '@/lib/server/auth-guard';
import pg from 'pg';

const { Pool } = pg;

/* ================================================================
   POST：把本周观察记录整理成平和的周报（前端 /weekly-report 调用）。
   补齐此前缺失的 POST handler——前端一直 POST，后端只有 GET，导致周报永远显示 mock。
   无 key/LLM 失败返 503，前台显示重试，不出假数据。
   ================================================================ */
export async function POST(request: Request) {
  if (!(await verifyAppApi(request))) return authError();

  const body = await request.json().catch(() => ({}));
  const observations: string[] = Array.isArray(body?.observations)
    ? body.observations.filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 30)
    : [];

  if (observations.length === 0) {
    return fail('NO_OBSERVATIONS', '本周还没有观察记录，先记录几条再来看周报。', undefined, 400);
  }

  const ai = await callAgentJson<{
    headline: string; summary: string; repeatedPatterns: string[]; keyObservation: string; nextWatchPoints: string[];
  }>('weeklyReview', '把家长这一周的若干条观察整理成一份平和、不评判的周报。', { observations }).catch(() => undefined);

  if (!ai?.headline) {
    return fail('WEEKLY_REVIEW_UNAVAILABLE', '本周周报暂时没有生成成功，可以稍后再试。', undefined, 503);
  }

  return ok({
    headline: ai.headline,
    summary: typeof ai.summary === 'string' ? ai.summary : '',
    repeatedPatterns: Array.isArray(ai.repeatedPatterns) ? ai.repeatedPatterns.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 4) : [],
    keyObservation: typeof ai.keyObservation === 'string' ? ai.keyObservation : '',
    nextWatchPoints: Array.isArray(ai.nextWatchPoints) ? ai.nextWatchPoints.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, 3) : [],
  });
}

export async function GET(request: Request) {
  if (!(await verifyAppApi(request))) return authError();

  const url = new URL(request.url);
  const familyId = url.searchParams.get('familyId') || 'f_demo';
  const childId = url.searchParams.get('childId') || 'c_demo';
  const identity = await getRequestIdentity({ familyId, childId });

  if (!isDatabaseEnabled()) {
    return ok({
      sessionCount: 0,
      recentClues: [],
      childEvents: [],
      weeklySummary: '本周还没有记录。完成一次对话并确认存档后，这里会出现本周的亲子互动线索。'
    });
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 10_000
    });

    const [memories, events, conversations] = await Promise.all([
      pool.query<{
        type: string;
        title: string;
        content: string;
        created_at: Date;
      }>(
        `SELECT type, title, content, created_at
         FROM memory_records
         WHERE family_id = $1 AND child_id = $2
           AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at DESC
         LIMIT 20`,
        [identity.familyId, identity.childId]
      ),
      pool.query<{
        title: string;
        event_text: string;
        created_at: Date;
      }>(
        `SELECT title, event_text, created_at
         FROM child_events
         WHERE family_id = $1 AND child_id = $2
           AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at DESC
         LIMIT 10`,
        [identity.familyId, identity.childId]
      ),
      pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM conversations
         WHERE family_id = $1 AND child_id = $2
           AND created_at > NOW() - INTERVAL '7 days'`,
        [identity.familyId, identity.childId]
      )
    ]);

    await pool.end();

    const sessionCount = conversations.rows[0]?.count || 0;
    const recentClues = memories.rows.map((row) => ({
      type: row.type,
      title: row.title,
      content: row.content,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : undefined
    }));
    const childEvents = events.rows.map((row) => ({
      title: row.title,
      eventText: row.event_text,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : undefined
    }));

    const hasData = recentClues.length > 0 || childEvents.length > 0;
    const weeklySummary = hasData
      ? `本周完成了 ${sessionCount} 次对话，新增 ${recentClues.length} 条线索，记录了 ${childEvents.length} 个孩子事件。`
      : '本周还没有记录。完成一次对话并确认存档后，这里会出现本周的亲子互动线索。';

    return ok({ sessionCount, recentClues, childEvents, weeklySummary });
  } catch (error) {
    console.error('[childos] weekly review failed', error);
    return ok({
      sessionCount: 0,
      recentClues: [],
      childEvents: [],
      weeklySummary: '本周回顾暂时加载失败，可以稍后再试。'
    });
  }
}
