import { View, Text, Input as TaroInput, Picker, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { loadChildBasicInfo, saveChildBasicInfo } from '@/services/childStorage'
import { apiRequest } from '@/services/api'
import { getProfileBuildRunState, subscribeProfileBuildRun, type ProfileBuildRunState } from '@/services/profilePipeline'
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

const PROVINCES = [
  '北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省',
  '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省',
  '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省', '重庆市', '四川省', '贵州省',
  '云南省', '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区',
  '香港特别行政区', '澳门特别行政区', '台湾省',
] as const

export default function OnboardingBasic() {
  useSafeShareAppMessage({ title: '育见 - 帮家长看见孩子' })
  const stored = loadChildBasicInfo()
  const [childName, setChildName] = useState(() => stored.childName)
  const [grade, setGrade] = useState(() => stored.grade)
  const [province, setProvince] = useState(() => stored.province)
  const [caregiverRelation, setCaregiverRelation] = useState(() => stored.caregiverRelation)
  const [companionTime, setCompanionTime] = useState(() => stored.companionTime)
  const [helpGoal, setHelpGoal] = useState(() => stored.helpGoal)
  const [saving, setSaving] = useState(false)
  const [buildRun, setBuildRun] = useState<ProfileBuildRunState | null>(() => getProfileBuildRunState())

  const gradeIndex = Math.max(0, GRADES.findIndex((g) => g === grade))
  const provinceIndex = Math.max(0, PROVINCES.findIndex((p) => p === province))

  useEffect(() => subscribeProfileBuildRun(setBuildRun), [])

  const next = async () => {
    if (!childName.trim() || !grade.trim() || !province.trim() || !caregiverRelation.trim() || !companionTime.trim() || !helpGoal.trim()) {
      Taro.showToast({ title: '请把基础资料填写完整', icon: 'none' })
      return
    }
    setSaving(true)
    const basicInfo = {
      childName: childName.trim(),
      grade: grade.trim(),
      province: province.trim(),
      caregiverRelation: caregiverRelation.trim(),
      companionTime: companionTime.trim(),
      helpGoal: helpGoal.trim(),
    }
    await saveChildBasicInfo(basicInfo)
    const res = await apiRequest<{ saved?: boolean; onboardingComplete?: boolean }>('/api/profile/basic', {
      method: 'POST',
      data: {
        nickname: basicInfo.childName,
        grade: basicInfo.grade,
        province: basicInfo.province,
        caregiverRelation: basicInfo.caregiverRelation,
        companionTime: basicInfo.companionTime,
        helpGoal: basicInfo.helpGoal,
      },
    })
    setSaving(false)
    if (!res.ok) {
      Taro.showToast({ title: res.error.message || '保存失败，请重试', icon: 'none' })
      return
    }
    const built = await apiRequest<{ snapshot?: { coreJudgment?: string } }>('/api/profile/built', { method: 'GET' })
    await mpGoReplace(
      built.ok && built.data.snapshot?.coreJudgment
        ? '/packageOnboarding/pages/result/index'
        : '/packageOnboarding/pages/generating/index'
    )
  }

  return (
    <HiFiBuildShell
      topTitle='补充孩子资料'
      stepLabel='画像准备中'
      progress={96}
      actions={[{ label: saving ? '保存中…' : '保存并查看画像', onClick: () => void next(), disabled: saving }]}
    >
      <HiFiBuildHero
        title='再补几条资料，让后续陪伴更贴近'
        copy={
          buildRun?.status === 'succeeded'
            ? '画像已经准备好。填写完成后就可以直接查看。'
            : buildRun?.status === 'running'
              ? buildRun.label
              : '资料会用于后续交流、任务、预演和成长轨迹，不改变正在整理的首版画像。'
        }
      />
      <View className='record-box basic-info-form'>
        <TaroInput
          className='basic-field'
          placeholder='孩子昵称（仅用于产品内称呼）'
          value={childName}
          onInput={(e) => setChildName(e.detail.value)}
        />
        <Picker
          mode='selector'
          range={[...GRADES]}
          value={gradeIndex >= 0 ? gradeIndex : 0}
          onChange={(e) => setGrade(GRADES[Number(e.detail.value)] || '')}
        >
          <View className='basic-field basic-picker' style={{ marginTop: '12px' }}>
            <Text>{grade || '请选择年级'}</Text>
          </View>
        </Picker>
        <Picker
          mode='selector'
          range={[...PROVINCES]}
          value={provinceIndex >= 0 ? provinceIndex : 0}
          onChange={(e) => setProvince(PROVINCES[Number(e.detail.value)] || '')}
        >
          <View className='basic-field basic-picker' style={{ marginTop: '12px' }}>
            <Text>{province || '孩子所在省份'}</Text>
          </View>
        </Picker>
        <TaroInput
          className='basic-field'
          placeholder='您是孩子的妈妈、爸爸，还是其他主要照护者？'
          value={caregiverRelation}
          onInput={(e) => setCaregiverRelation(e.detail.value)}
        />
        <Textarea
          className='basic-field basic-textarea'
          placeholder='您平时陪孩子的时间大概有多少？'
          value={companionTime}
          maxlength={200}
          onInput={(e) => setCompanionTime(e.detail.value)}
        />
        <Textarea
          className='basic-field basic-textarea'
          placeholder='您希望育见怎么帮到孩子？'
          value={helpGoal}
          maxlength={500}
          onInput={(e) => setHelpGoal(e.detail.value)}
        />
      </View>
    </HiFiBuildShell>
  )
}
