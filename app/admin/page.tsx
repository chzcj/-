'use client'

import { AlertTriangle, RefreshCw, Settings } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingResult } from '@/components/states/LoadingResult'
import { ErrorState } from '@/components/states/ErrorState'
import { apiClient, type AdminOverview } from '@/lib/api-client'

const cardStyle: CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  padding: 18,
  marginBottom: 14
}
const sectionTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 12
}

function Badge({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  const color = ok ? 'var(--success)' : warn ? 'var(--warning)' : 'var(--danger)'
  const bg = ok ? 'rgba(79,159,114,0.12)' : warn ? 'rgba(217,139,43,0.12)' : 'rgba(228,90,90,0.12)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
      {label}
    </span>
  )
}

function jobLabel(k: string) {
  return ({ pending: '待处理', running: '执行中', retrying: '重试', succeeded: '成功', failed: '失败' } as Record<string, string>)[k] || k
}
function sourceLabel(s: string) {
  return ({ db: '面板配置', env: '环境变量', none: '无' } as Record<string, string>)[s] || s
}

function AIRow({ title, model, baseUrl, keyMasked, configured, source }: { title: string; model: string; baseUrl: string; keyMasked: string; configured: boolean; source: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(110,106,248,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ fontSize: 11, color: configured ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
          {configured ? '已启用' : '未配置'} · {sourceLabel(source)}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        模型 {model || '—'}<br />地址 {baseUrl || '—'}<br />密钥 {keyMasked || '未设置'}
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [failed, setFailed] = useState(false)

  async function load() {
    setLoading(true)
    setFailed(false)
    setForbidden(false)
    const res = await apiClient.adminOverview()
    if (res.ok) setData(res.data)
    else if (res.error.code === 'FORBIDDEN' || res.error.code === 'UNAUTHORIZED') setForbidden(true)
    else setFailed(true)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  if (loading) {
    return <AppShell><LoadingResult title="管理员后台" messages={['正在读取系统状态...', '汇总业务与任务数据...']} /></AppShell>
  }
  if (forbidden) {
    return <AppShell><ErrorState title="需要管理员权限" description="当前账号不是管理员，无法访问后台。" primaryLabel="返回首页" onPrimary={() => router.push('/home')} /></AppShell>
  }
  if (failed || !data) {
    return <AppShell><ErrorState title="加载失败" description="后台数据暂时拿不到，可以稍后重试。" primaryLabel="重试" onPrimary={() => void load()} secondaryLabel="返回首页" onSecondary={() => router.push('/home')} /></AppShell>
  }

  const s = data.system
  const biz = data.business
  const statItems = [
    { label: '用户', key: 'users' },
    { label: '对话', key: 'conversations' },
    { label: '档案', key: 'archives' },
    { label: '记忆记录', key: 'memoryRecords' },
    { label: '孩子事件', key: 'childEvents' },
    { label: '记忆层条目', key: 'memoryLayerItems' },
    { label: 'Episode', key: 'evidenceEpisodes' },
    { label: 'FactAtom', key: 'factAtoms' }
  ]

  return (
    <AppShell>
      <div className="page without-voice">
        <PageHeader
          title="管理员后台"
          showBack
          onBack={() => router.push('/home')}
          rightSlot={
            <button
              type="button"
              onClick={() => router.push('/admin/config')}
              aria-label="AI 配置"
              style={{ width: 40, height: 40, borderRadius: 16, background: 'rgba(255,255,255,0.64)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
            >
              <Settings size={20} />
            </button>
          }
        />

        <div style={cardStyle}>
          <div style={sectionTitle}>系统健康</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Badge ok={s.databaseReady} label={s.databaseReady ? '数据库已连接' : '数据库未就绪'} />
            <Badge ok={s.vectorReady} warn={!s.vectorReady} label={s.vectorReady ? 'pgvector 正常' : 'pgvector 降级'} />
            <Badge ok={s.fastConfigured} warn={!s.fastConfigured} label={s.fastConfigured ? '对话模型已配' : '对话模型未配'} />
            <Badge ok={s.embeddingConfigured} warn={!s.embeddingConfigured} label={s.embeddingConfigured ? '向量模型已配' : '向量模型未配'} />
            {s.mockModeInProduction ? <Badge ok={false} label="生产误用 mock" /> : null}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
            环境 {s.nodeEnv} · Cookie Secure {s.cookieSecure ? '开' : '关'}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}>业务数据统计</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            {statItems.map((it) => (
              <div key={it.key} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand)' }}>{Number(biz[it.key] ?? 0)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{it.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}>后台任务队列</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: data.jobs.recentFailures.length ? 12 : 0 }}>
            {(['pending', 'running', 'retrying', 'succeeded', 'failed'] as const).map((k) => (
              <div key={k} style={{ padding: '6px 12px', borderRadius: 12, background: 'rgba(110,106,248,0.06)', fontSize: 12, color: 'var(--text-secondary)' }}>
                {jobLabel(k)} <b style={{ color: k === 'failed' && data.jobs.totals.failed > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{data.jobs.totals[k]}</b>
              </div>
            ))}
          </div>
          {data.jobs.recentFailures.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={13} /> 最近失败
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.jobs.recentFailures.map((f, i) => (
                  <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(228,90,90,0.05)', borderRadius: 10, padding: '6px 10px' }}>
                    <b>{f.jobType}</b>（{f.attempts}/{f.maxAttempts}）{f.lastError}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>AI 配置状态</span>
            <button type="button" onClick={() => router.push('/admin/config')} style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>去配置 →</button>
          </div>
          <AIRow title="对话模型" model={data.ai.fastAi.model} baseUrl={data.ai.fastAi.baseUrl} keyMasked={data.ai.fastAi.apiKeyMasked} configured={data.ai.fastAi.configured} source={data.ai.fastAi.source} />
          <div style={{ height: 10 }} />
          <AIRow title="向量模型" model={data.ai.embedding.model} baseUrl={data.ai.embedding.baseUrl} keyMasked={data.ai.embedding.apiKeyMasked} configured={data.ai.embedding.configured} source={data.ai.embedding.source} />
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="secondary-button"
          style={{ width: '100%', borderRadius: 999, height: 48, fontSize: 14, fontWeight: 600 }}
        >
          <RefreshCw size={16} style={{ marginRight: 6 }} /> 刷新
        </button>
      </div>
    </AppShell>
  )
}
