import { View, Text, Input as TaroInput, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { firstBuildEntryPath } from '@/lib/buildEntries'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { loadChildBasicInfo, saveChildBasicInfo } from '@/services/childStorage'
import './index.scss'

const GRADES = [
  '幼儿园',
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

export default function OnboardingBasic() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })
  const [childName, setChildName] = useState(() => loadChildBasicInfo().childName)
  const [grade, setGrade] = useState(() => loadChildBasicInfo().grade)
  const [saving, setSaving] = useState(false)

  const gradeIndex = Math.max(0, GRADES.findIndex((g) => g === grade))

  const next = async () => {
    if (!childName.trim() || !grade.trim()) {
      Taro.showToast({ title: '请填写孩子昵称和年级', icon: 'none' })
      return
    }
    setSaving(true)
    await saveChildBasicInfo({ childName: childName.trim(), grade: grade.trim() })
    setSaving(false)
    await mpGoReplace(firstBuildEntryPath())
  }

  return (
    <HiFiBuildShell
      topTitle='基本信息'
      stepLabel='1/4 准备'
      progress={16}
      actions={[{ label: saving ? '保存中…' : '下一步', onClick: () => void next(), disabled: saving }]}
    >
      <HiFiBuildHero
        title='先认识孩子'
        copy='怎么称呼孩子、几年级（会保存到服务器，换机不丢）'
      />
      <View className='record-box'>
        <TaroInput
          className='record-textarea'
          placeholder='孩子昵称'
          value={childName}
          onInput={(e) => setChildName(e.detail.value)}
        />
        <Picker
          mode='selector'
          range={[...GRADES]}
          value={gradeIndex >= 0 ? gradeIndex : 0}
          onChange={(e) => setGrade(GRADES[Number(e.detail.value)] || '')}
        >
          <View className='record-textarea picker-field' style={{ marginTop: '12px' }}>
            <Text>{grade || '请选择年级'}</Text>
          </View>
        </Picker>
      </View>
    </HiFiBuildShell>
  )
}
