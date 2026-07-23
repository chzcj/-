'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { saveChildBasicInfo, getActiveChild, getChildDisplayName } from '@/lib/storage/childStorage'
import { childSystemCopy } from '@yujian/contracts/child-system-copy'
import { forceAccountSyncToServer } from '@/lib/account/accountSync'
import { getStorage, updateStorage } from '@/lib/storage/localStorageService'

export type EditModalKind = 'profile' | 'child' | 'password' | 'delete'

type Props = {
  kind: EditModalKind | null
  onClose: () => void
  onLoggedOut?: () => void
}

/** 家长身份选项 */
const IDENTITIES = ['妈妈', '爸爸', '其他'] as const
const GRADES = ['幼儿园', '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'] as const

/** 读取本地家长信息（与 onboarding/basic 同源） */
function readParentInfo(): { identity: string; nickname: string } {
  const s = getStorage()
  const parent = (s.parentInfo || {}) as { identity?: string; nickname?: string }
  return { identity: parent.identity || '妈妈', nickname: parent.nickname || '' }
}

function writeParentInfo(input: { identity: string; nickname: string }) {
  updateStorage((cur) => ({ ...cur, parentInfo: { ...(cur.parentInfo || {}), ...input, updatedAt: Date.now() } }))
}

export function ProfileEditModals({ kind, onClose, onLoggedOut }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')

  // 表单状态
  const [identity, setIdentity] = useState('妈妈')
  const [nickname, setNickname] = useState('')
  const [childName, setChildName] = useState('')
  const [childGrade, setChildGrade] = useState('高一')
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  // 打开 modal 时初始化表单
  useEffect(() => {
    if (!kind) return
    setToast('')
    setSubmitting(false)
    if (kind === 'profile') {
      const p = readParentInfo()
      setIdentity(p.identity)
      setNickname(p.nickname)
    }
    if (kind === 'child') {
      const c = getActiveChild()
      setChildName(c?.nickname || '')
      setChildGrade(c?.grade || '高一')
    }
    if (kind === 'password' || kind === 'delete') {
      setOldPwd(''); setNewPwd(''); setConfirmPwd(''); setDeleteConfirm('')
    }
  }, [kind])

  if (!kind) return null

  const close = () => {
    if (submitting) return
    onClose()
  }

  async function submitProfile() {
    if (!nickname.trim()) return setToast('请填写称呼')
    setSubmitting(true)
    try {
      writeParentInfo({ identity, nickname: nickname.trim() })
      void forceAccountSyncToServer()
      setToast('已保存')
      setTimeout(onClose, 600)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitChild() {
    if (!childName.trim()) return setToast('请填写孩子称呼')
    setSubmitting(true)
    try {
      saveChildBasicInfo({ nickname: childName.trim(), grade: childGrade })
      void forceAccountSyncToServer()
      setToast('已保存')
      setTimeout(onClose, 600)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitPassword() {
    if (!oldPwd || !newPwd) return setToast('请填写旧密码与新密码')
    if (newPwd.length < 8) return setToast('新密码至少 8 位')
    if (newPwd !== confirmPwd) return setToast('两次新密码不一致')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) return setToast(json.message || '修改失败，请重试')
      setToast('密码已更新')
      setTimeout(onClose, 600)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitDelete() {
    if (deleteConfirm.trim() !== '确认注销') return setToast('请输入"确认注销"以继续')
    setSubmitting(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: deleteConfirm.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) return setToast(json.message || '注销失败，请重试')
      setToast('已发起注销，30 天内可恢复')
      setTimeout(() => onLoggedOut?.(), 800)
    } finally {
      setSubmitting(false)
    }
  }

  const childCopy = childSystemCopy(getChildDisplayName())

  const titles: Record<EditModalKind, string> = {
    profile: '编辑个人资料',
    child: childCopy.editChildInfo,
    password: '修改密码',
    delete: '注销账号',
  }

  return (
    <div className="edit-modal-backdrop" onClick={close}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-header">
          <h2>{titles[kind]}</h2>
          <button type="button" className="edit-modal-close" onClick={close} aria-label="关闭" disabled={submitting}>
            <X size={18} />
          </button>
        </div>

        {kind === 'profile' && (
          <div className="edit-modal-body">
            <label className="edit-label">你的身份</label>
            <div className="edit-pill-row">
              {IDENTITIES.map((it) => (
                <button
                  key={it}
                  type="button"
                  className={`edit-pill${identity === it ? ' active' : ''}`}
                  onClick={() => setIdentity(it)}
                >
                  {it}
                </button>
              ))}
            </div>
            <label className="edit-label">你的称呼</label>
            <input
              className="edit-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="如：宝宝妈妈"
            />
          </div>
        )}

        {kind === 'child' && (
          <div className="edit-modal-body">
            <label className="edit-label">孩子称呼</label>
            <input
              className="edit-input"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="孩子的小名"
            />
            <label className="edit-label">年级</label>
            <select className="edit-input" value={childGrade} onChange={(e) => setChildGrade(e.target.value)}>
              {GRADES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        )}

        {kind === 'password' && (
          <div className="edit-modal-body">
            <label className="edit-label">旧密码</label>
            <input className="edit-input" type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
            <label className="edit-label">新密码（至少 8 位）</label>
            <input className="edit-input" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <label className="edit-label">再次输入新密码</label>
            <input className="edit-input" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </div>
        )}

        {kind === 'delete' && (
          <div className="edit-modal-body">
            <p className="edit-warn">
              注销后，账号将进入 30 天恢复期；期间重新登录可恢复全部数据，逾期将永久删除画像、交流与任务记录。
            </p>
            <label className="edit-label">{'请输入"确认注销"以继续'}</label>
            <input
              className="edit-input"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="确认注销"
            />
          </div>
        )}

        {toast && <p className="edit-toast">{toast}</p>}

        <div className="edit-modal-footer">
          <button type="button" className="edit-cancel" onClick={close} disabled={submitting}>取消</button>
          <button
            type="button"
            className={`edit-submit${kind === 'delete' ? ' danger' : ''}`}
            disabled={submitting}
            onClick={() => {
              if (kind === 'profile') void submitProfile()
              else if (kind === 'child') void submitChild()
              else if (kind === 'password') void submitPassword()
              else void submitDelete()
            }}
          >
            {submitting ? '提交中…' : kind === 'delete' ? '确认注销' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
