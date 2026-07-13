'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { HiFiBuildHero } from '@/components/profile/HiFiBuildHero'
import { HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { firstBuildEntryPath } from '@/lib/profile/buildEntries'
import { getActiveChild, saveChildBasicInfo } from '@/lib/storage/childStorage'

const gradeOptions = [
  '幼儿园小班',
  '幼儿园中班',
  '幼儿园大班',
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
  '初一',
  '初二',
  '初三',
  '高一',
  '高二',
  '高三',
] as const

export default function ProfileBuildBasicPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [grade, setGrade] = useState('')
  const [age, setAge] = useState('')
  const [customGrade, setCustomGrade] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const child = getActiveChild()
    if (child?.nickname && child.nickname !== '孩子') setNickname(child.nickname)
    if (child?.grade) {
      if (gradeOptions.includes(child.grade as (typeof gradeOptions)[number])) {
        setGrade(child.grade)
      } else {
        setGrade('其他')
        setCustomGrade(child.grade)
      }
    }
    if (child?.age) setAge(String(child.age))
  }, [])

  const resolvedGrade = grade === '其他' ? customGrade.trim() : grade.trim()
  const canSubmit = nickname.trim().length >= 1 && resolvedGrade.length >= 1 && !submitting

  function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    const parsedAge = age.trim() ? Number.parseInt(age.trim(), 10) : undefined
    saveChildBasicInfo({
      nickname: nickname.trim(),
      grade: resolvedGrade,
      age: parsedAge && !Number.isNaN(parsedAge) ? parsedAge : undefined,
    })
    // 同步上送服务端（fire-and-forget）：年龄/年级供预演口吻与发展阶段判断，仅存本地则后端一无所知
    void fetch('/api/profile/basic', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname: nickname.trim(),
        grade: resolvedGrade,
        age: parsedAge && !Number.isNaN(parsedAge) ? String(parsedAge) : '',
      }),
    }).catch(() => {})
    router.push(firstBuildEntryPath())
  }

  return (
    <HiFiBuildShell
      topTitle="先填一点基础信息"
      stepLabel="孩子背景"
      progress={18}
      onBack={() => router.push('/profile/build/intro?review=1')}
      actions={
        canSubmit
          ? [
              {
                label: '提交基础信息',
                icon: <Check size={18} />,
                onClick: handleSubmit,
              },
            ]
          : []
      }
    >
      <HiFiBuildHero
        kicker="孩子背景"
        title="先描一笔背景"
        copy="昵称和年级会帮助后面的判断更有分寸，年龄可选填。"
        compact
        mascot={false}
      />

      <section className="form-grid">
        <label className="field-card" htmlFor="child-nickname">
          <span className="field-label">孩子昵称</span>
          <input
            id="child-nickname"
            className="text-field"
            type="text"
            placeholder="例如：小树"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoComplete="off"
          />
        </label>

        <div className="split-grid">
          <label className="field-card" htmlFor="child-age">
            <span className="field-label">年龄（可选）</span>
            <input
              id="child-age"
              className="text-field"
              type="text"
              inputMode="numeric"
              placeholder="例如：9"
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
              autoComplete="off"
            />
          </label>

          <label className="field-card" htmlFor="child-grade">
            <span className="field-label">年级</span>
            <select
              id="child-grade"
              className="text-field"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              <option value="">请选择</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value="其他">其他</option>
            </select>
          </label>
        </div>

        {grade === '其他' ? (
          <label className="field-card" htmlFor="child-grade-custom">
            <span className="field-label">填写年级</span>
            <input
              id="child-grade-custom"
              className="text-field"
              type="text"
              placeholder="例如：三年级"
              value={customGrade}
              onChange={(e) => setCustomGrade(e.target.value)}
              maxLength={20}
              autoComplete="off"
            />
          </label>
        ) : null}
      </section>
    </HiFiBuildShell>
  )
}
