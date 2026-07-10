import { View, Text, Input as TaroInput } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { firstBuildEntryPath } from '@/lib/buildEntries'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { loadChildBasicInfo, saveChildBasicInfo } from '@/services/childStorage'

export default function OnboardingBasic() {
  const [childName, setChildName] = useState(() => loadChildBasicInfo().childName)
  const [grade, setGrade] = useState(() => loadChildBasicInfo().grade)
  const [saving, setSaving] = useState(false)

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
        <TaroInput
          className='record-textarea'
          style={{ marginTop: '12px' }}
          placeholder='年级，如初一'
          value={grade}
          onInput={(e) => setGrade(e.detail.value)}
        />
      </View>
    </HiFiBuildShell>
  )
}
