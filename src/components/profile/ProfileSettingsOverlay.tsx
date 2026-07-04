'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { forceAccountSyncToServer } from '@/lib/account/accountSync'
import { clearAllChildOSData } from '@/lib/storage/localStorageService'

type ProfileSettingsOverlayProps = {
  open: boolean
  onClose: () => void
}

export function ProfileSettingsOverlay({ open, onClose }: ProfileSettingsOverlayProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    await forceAccountSyncToServer()
    const result = await apiClient.logout()
    clearAllChildOSData()
    onClose()
    if (result.ok) {
      router.replace('/login?logged_out=1')
    } else {
      setLoggingOut(false)
    }
  }

  return (
    <section className={`settings-overlay${open ? '' : ' hidden'}`} aria-hidden={!open}>
      <button className="overlay-backdrop" type="button" aria-label="关闭设置" onClick={onClose} />
      <section className="settings-sheet" role="dialog" aria-modal="true" aria-label="个人设置">
        <div className="sheet-header">
          <div>
            <h2 className="sheet-title">设置</h2>
            <p className="sheet-subtitle">账号、登录与基础数据管理。</p>
          </div>
          <button className="icon-button" type="button" aria-label="关闭设置" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="settings-grid compact-settings">
          <div className="setting-group">
            <h3>画像</h3>
            <button className="setting-row" type="button" onClick={() => { onClose(); router.push('/profile/result') }}>
              <strong>查看完整画像</strong>
              <span className="setting-value">进入</span>
            </button>
            <button className="setting-row" type="button" onClick={() => { onClose(); router.push('/profile/deep') }}>
              <strong>机制链解释</strong>
              <span className="setting-value">进入</span>
            </button>
          </div>

          <div className="setting-group">
            <h3>数据与帮助</h3>
            <button className="setting-row" type="button" onClick={onClose}>
              <strong>隐私与数据</strong>
              <span>导出 / 删除记录</span>
            </button>
            <button className="setting-row" type="button" onClick={onClose}>
              <strong>帮助与反馈</strong>
              <span className="setting-value">提交</span>
            </button>
          </div>

          <button
            className="setting-row logout-row"
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
          >
            <strong>{loggingOut ? '正在保存并退出…' : '退出登录'}</strong>
            <span className="setting-value">{loggingOut ? '请稍候' : '退出'}</span>
          </button>
        </div>
      </section>
    </section>
  )
}
