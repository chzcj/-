'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingResult } from '@/components/states/LoadingResult'
import { ErrorState } from '@/components/states/ErrorState'
import { apiClient, type AdminAIConfigStatus, type AdminConfigInput } from '@/lib/api-client'

const noticeStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  background: 'rgba(217,139,43,0.1)',
  border: '1px solid rgba(217,139,43,0.2)',
  color: 'var(--warning)',
  fontSize: 13,
  lineHeight: 1.5,
  marginBottom: 14
}

function Field({ label, value, onChange, placeholder, type }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      <input
        type={type || 'text'}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', height: 44, borderRadius: 14, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.72)', padding: '0 14px', fontSize: 14, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
      />
    </label>
  )
}

export default function AdminConfigPage() {
  const router = useRouter()
  const [status, setStatus] = useState<AdminAIConfigStatus | null>(null)
  const [encAvailable, setEncAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // apiKey 留空 = 不改；其它字段回填当前值。
  const [fastKey, setFastKey] = useState('')
  const [fastBase, setFastBase] = useState('')
  const [fastModel, setFastModel] = useState('')
  const [fastTemp, setFastTemp] = useState('')
  const [embKey, setEmbKey] = useState('')
  const [embBase, setEmbBase] = useState('')
  const [embModel, setEmbModel] = useState('')

  async function load() {
    setLoading(true)
    setFailed(false)
    setForbidden(false)
    const res = await apiClient.adminGetConfig()
    if (res.ok) {
      const c = res.data.config
      setStatus(c)
      setEncAvailable(res.data.encryptionAvailable)
      setFastBase(c.fastAi.baseUrl)
      setFastModel(c.fastAi.model)
      setFastTemp(String(c.fastAi.temperature))
      setEmbBase(c.embedding.baseUrl)
      setEmbModel(c.embedding.model)
    } else if (res.error.code === 'FORBIDDEN' || res.error.code === 'UNAUTHORIZED') {
      setForbidden(true)
    } else {
      setFailed(true)
    }
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function save() {
    setSaving(true)
    setToast(null)
    const input: AdminConfigInput = {
      fastAi: {
        baseUrl: fastBase,
        model: fastModel,
        ...(fastTemp ? { temperature: Number(fastTemp) } : {}),
        ...(fastKey ? { apiKey: fastKey } : {})
      },
      embedding: {
        baseUrl: embBase,
        model: embModel,
        ...(embKey ? { apiKey: embKey } : {})
      }
    }
    const res = await apiClient.adminSaveConfig(input)
    setSaving(false)
    if (res.ok) {
      setStatus(res.data.config)
      setFastKey('')
      setEmbKey('')
      setToast('已保存并即时生效')
    } else {
      setToast(res.error.message || '保存失败')
    }
  }

  if (loading) {
    return <AppShell><LoadingResult title="AI 配置" messages={['读取当前配置...']} /></AppShell>
  }
  if (forbidden) {
    return <AppShell><ErrorState title="需要管理员权限" description="当前账号不是管理员。" primaryLabel="返回首页" onPrimary={() => router.push('/home')} /></AppShell>
  }
  if (failed || !status) {
    return <AppShell><ErrorState title="加载失败" description="配置暂时拿不到。" primaryLabel="重试" onPrimary={() => void load()} secondaryLabel="返回" onSecondary={() => router.push('/admin')} /></AppShell>
  }

  return (
    <AppShell>
      <div className="page without-voice">
        <PageHeader title="AI 配置" showBack onBack={() => router.push('/admin')} />

        {!encAvailable && (
          <div style={noticeStyle}>
            未配置 SETTINGS_ENC_KEY，暂不能保存 API Key（可保存地址 / 模型）。请在环境变量配置后重启服务。
          </div>
        )}

        <Field label="对话模型 API Key" type="password" value={fastKey} onChange={setFastKey} placeholder={status.fastAi.apiKeySet ? `已设置 ${status.fastAi.apiKeyMasked}（留空不改）` : '未设置'} />
        <Field label="对话模型 Base URL" value={fastBase} onChange={setFastBase} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
        <Field label="对话模型 Model" value={fastModel} onChange={setFastModel} placeholder="qwen-plus" />
        <Field label="对话模型 Temperature" value={fastTemp} onChange={setFastTemp} placeholder="0.25" />

        <div style={{ height: 8 }} />

        <Field label="向量模型 API Key" type="password" value={embKey} onChange={setEmbKey} placeholder={status.embedding.apiKeySet ? `已设置 ${status.embedding.apiKeyMasked}（留空不改）` : '未设置'} />
        <Field label="向量模型 Base URL" value={embBase} onChange={setEmbBase} placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
        <Field label="向量模型 Model" value={embModel} onChange={setEmbModel} placeholder="text-embedding-v3" />

        {toast && <div style={{ marginTop: 12, fontSize: 13, color: 'var(--brand)', textAlign: 'center', fontWeight: 600 }}>{toast}</div>}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="primary-button"
          style={{ width: '100%', borderRadius: 999, height: 52, fontSize: 16, fontWeight: 600, marginTop: 14 }}
        >
          {saving ? '保存中...' : '保存并即时生效'}
        </button>
      </div>
    </AppShell>
  )
}
