import { View, Text, Textarea, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui'
import { loadChildBasicInfo, saveChildBasicInfo } from '@/services/childStorage'
import { apiRequest } from '@/services/api'
import { logout } from '@/services/auth'
import { clearAllChildOSData } from '@/services/localStorageService'
import './ProfileEditModals.scss'

export type EditModalKind = 'profile' | 'child' | 'password' | 'delete' | null

type ProfileEditModalsProps = {
  kind: EditModalKind
  onClose: () => void
}

export function ProfileEditModals({ kind, onClose }: ProfileEditModalsProps) {
  const [childName, setChildName] = useState(loadChildBasicInfo().childName)
  const [grade, setGrade] = useState(loadChildBasicInfo().grade)
  const [nickname, setNickname] = useState('')
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [toast, setToast] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!kind) return
    setToast('')
    setSubmitting(false)
    if (kind === 'child') {
      const basic = loadChildBasicInfo()
      setChildName(basic.childName)
      setGrade(basic.grade)
    }
    if (kind === 'password' || kind === 'delete') {
      setOldPwd('')
      setNewPwd('')
      setConfirmPwd('')
      setDeleteConfirm('')
    }
  }, [kind])

  if (!kind) return null

  const titles: Record<Exclude<EditModalKind, null>, string> = {
    profile: '账号设置',
    child: '编辑孩子信息',
    password: '修改密码',
    delete: '注销账号',
  }

  const saveChild = async () => {
    if (!childName.trim()) return setToast('请填写孩子称呼')
    setSubmitting(true)
    await saveChildBasicInfo({ childName: childName.trim(), grade: grade.trim() })
    setSubmitting(false)
    Taro.showToast({ title: '已保存', icon: 'success' })
    onClose()
  }

  const saveProfile = async () => {
    if (!nickname.trim()) return setToast('请填写昵称')
    setSubmitting(true)
    const res = await apiRequest('/api/account/profile', {
      method: 'PUT',
      data: { nickname: nickname.trim() },
    })
    setSubmitting(false)
    if (res.ok) {
      Taro.showToast({ title: '已更新', icon: 'success' })
      onClose()
    } else {
      setToast(res.error.message)
    }
  }

  const submitPassword = async () => {
    if (!oldPwd || !newPwd) return setToast('请填写旧密码与新密码')
    if (newPwd.length < 8) return setToast('新密码至少 8 位')
    if (newPwd !== confirmPwd) return setToast('两次新密码不一致')
    setSubmitting(true)
    const res = await apiRequest('/api/auth/change-password', {
      method: 'POST',
      data: { oldPassword: oldPwd, newPassword: newPwd },
    })
    setSubmitting(false)
    if (!res.ok) return setToast(res.error.message || '修改失败，请重试')
    Taro.showToast({ title: '密码已更新', icon: 'success' })
    onClose()
  }

  const submitDelete = async () => {
    if (deleteConfirm.trim() !== '确认注销') return setToast('请输入「确认注销」以继续')
    setSubmitting(true)
    const res = await apiRequest('/api/account/delete', {
      method: 'POST',
      data: { confirm: deleteConfirm.trim() },
    })
    setSubmitting(false)
    if (!res.ok) return setToast(res.error.message || '注销失败，请重试')
    await logout()
    clearAllChildOSData()
    onClose()
    void Taro.reLaunch({ url: '/pages/login/index' })
  }

  const handleLogout = () => {
    void logout().then(() => {
      onClose()
      void Taro.reLaunch({ url: '/pages/login/index' })
    })
  }

  return (
    <Modal open title={titles[kind]} onClose={onClose}>
      {kind === 'child' ? (
        <View>
          <Textarea
            className='modal-field'
            value={childName}
            placeholder='孩子昵称'
            onInput={(e) => setChildName(e.detail.value)}
          />
          <Textarea
            className='modal-field'
            value={grade}
            placeholder='年级'
            onInput={(e) => setGrade(e.detail.value)}
          />
          <Text className='pill primary' onClick={() => void saveChild()}>
            保存
          </Text>
        </View>
      ) : null}

      {kind === 'profile' ? (
        <View>
          <Textarea
            className='modal-field'
            value={nickname}
            placeholder='你的昵称'
            onInput={(e) => setNickname(e.detail.value)}
          />
          <Text className='pill primary' onClick={() => void saveProfile()}>
            保存昵称
          </Text>
          <Text className='pill' style={{ marginTop: '10px' }} onClick={handleLogout}>
            退出登录
          </Text>
        </View>
      ) : null}

      {kind === 'password' ? (
        <View>
          <Input
            className='modal-field'
            password
            value={oldPwd}
            placeholder='旧密码'
            onInput={(e) => setOldPwd(e.detail.value)}
          />
          <Input
            className='modal-field'
            password
            value={newPwd}
            placeholder='新密码（至少 8 位）'
            onInput={(e) => setNewPwd(e.detail.value)}
          />
          <Input
            className='modal-field'
            password
            value={confirmPwd}
            placeholder='再次输入新密码'
            onInput={(e) => setConfirmPwd(e.detail.value)}
          />
          <Text className='pill primary' onClick={() => void submitPassword()}>
            {submitting ? '提交中…' : '保存'}
          </Text>
        </View>
      ) : null}

      {kind === 'delete' ? (
        <View>
          <Text className='modal-warn'>
            注销后账号进入 30 天恢复期；期间重新登录可恢复数据，逾期将永久删除画像、交流与任务记录。
          </Text>
          <Input
            className='modal-field'
            value={deleteConfirm}
            placeholder='确认注销'
            onInput={(e) => setDeleteConfirm(e.detail.value)}
          />
          <Text className='pill danger' onClick={() => void submitDelete()}>
            {submitting ? '提交中…' : '确认注销'}
          </Text>
        </View>
      ) : null}

      {toast ? <Text className='modal-toast'>{toast}</Text> : null}
    </Modal>
  )
}
