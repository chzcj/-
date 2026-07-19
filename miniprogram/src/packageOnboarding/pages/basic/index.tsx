import { View, Text, Input, Picker, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { HiFiBuildHero, HiFiBuildShell } from '@/components/profile/HiFiBuildShell'
import { useSafeShareAppMessage } from '@/hooks/useSharePage'
import { mpGoReplace } from '@/lib/mpOnboardingNav'
import { loadChildBasicInfo, saveChildBasicInfo } from '@/services/childStorage'
import { apiRequest } from '@/services/api'
import {
  fetchServerBuildRun,
  getProfileBuildRunState,
  subscribeProfileBuildRun,
  type ProfileBuildRunState,
} from '@/services/profilePipeline'
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

type ServerBasic = {
  nickname?: string
  grade?: string
  province?: string
  caregiverRelation?: string
  companionTime?: string
  helpGoal?: string
}

function applyBasicFields(
  basic: ServerBasic,
  setters: {
    setChildName: (v: string) => void
    setGrade: (v: string) => void
    setProvince: (v: string) => void
    setCaregiverRelation: (v: string) => void
    setCompanionTime: (v: string) => void
    setHelpGoal: (v: string) => void
  }
) {
  if (basic.nickname?.trim()) setters.setChildName(basic.nickname.trim())
  if (basic.grade?.trim()) setters.setGrade(basic.grade.trim())
  if (basic.province?.trim()) setters.setProvince(basic.province.trim())
  if (basic.caregiverRelation?.trim()) setters.setCaregiverRelation(basic.caregiverRelation.trim())
  if (basic.companionTime?.trim()) setters.setCompanionTime(basic.companionTime.trim())
  if (basic.helpGoal?.trim()) setters.setHelpGoal(basic.helpGoal.trim())
}

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

  useEffect(() => {
    void apiRequest<{ basic?: ServerBasic | null }>('/api/profile/basic', { method: 'GET' }).then(
      (res) => {
        if (!res.ok || !res.data.basic) return
        applyBasicFields(res.data.basic, {
          setChildName,
          setGrade,
          setProvince,
          setCaregiverRelation,
          setCompanionTime,
          setHelpGoal,
        })
      }
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      const remote = await fetchServerBuildRun()
      if (!cancelled && remote) setBuildRun(remote)
    }
    void tick()
    const timer = setInterval(() => {
      if (buildRun?.status === 'running' || buildRun?.status === 'pending') void tick()
    }, 2500)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [buildRun?.status])

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
    const runReady = buildRun?.status === 'succeeded' || buildRun?.firstVisibleSnapshotReady
    await mpGoReplace(
      (built.ok && built.data.snapshot?.coreJudgment) || runReady
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

      <View className='basic-form'>
        <Text className='basic-section-title'>姓名与年级</Text>
        <View className='basic-field-card'>
          <Text className='basic-field-label'>孩子昵称</Text>
          <Input
            className='basic-field-input'
            type='text'
            placeholder='例如：小树（仅用于产品内称呼）'
            placeholderClass='basic-field-placeholder'
            value={childName}
            maxlength={20}
            onInput={(e) => setChildName(e.detail.value)}
          />
        </View>
        <View className='basic-field-row'>
          <View className='basic-field-card basic-field-card--half'>
            <Text className='basic-field-label'>年级</Text>
            <Picker
              mode='selector'
              range={[...GRADES]}
              value={gradeIndex >= 0 ? gradeIndex : 0}
              onChange={(e) => setGrade(GRADES[Number(e.detail.value)] || '')}
            >
              <View className='basic-picker-value'>
                <Text className={grade ? 'basic-picker-text' : 'basic-field-placeholder'}>
                  {grade || '请选择'}
                </Text>
              </View>
            </Picker>
          </View>
          <View className='basic-field-card basic-field-card--half'>
            <Text className='basic-field-label'>所在省份</Text>
            <Picker
              mode='selector'
              range={[...PROVINCES]}
              value={provinceIndex >= 0 ? provinceIndex : 0}
              onChange={(e) => setProvince(PROVINCES[Number(e.detail.value)] || '')}
            >
              <View className='basic-picker-value'>
                <Text className={province ? 'basic-picker-text' : 'basic-field-placeholder'}>
                  {province || '请选择'}
                </Text>
              </View>
            </Picker>
          </View>
        </View>

        <Text className='basic-section-title'>家庭关系</Text>
        <View className='basic-field-card'>
          <Text className='basic-field-label'>您和孩子的关系</Text>
          <Input
            className='basic-field-input'
            type='text'
            placeholder='例如：妈妈、爸爸、奶奶'
            placeholderClass='basic-field-placeholder'
            value={caregiverRelation}
            maxlength={40}
            onInput={(e) => setCaregiverRelation(e.detail.value)}
          />
        </View>
        <View className='basic-field-card'>
          <Text className='basic-field-label'>平时陪孩子的时间</Text>
          <Textarea
            className='basic-field-textarea'
            placeholder='例如：工作日晚上 1 小时，周末上午一起出门'
            placeholderClass='basic-field-placeholder'
            value={companionTime}
            maxlength={200}
            autoHeight
            onInput={(e) => setCompanionTime(e.detail.value)}
          />
        </View>
        <View className='basic-field-card'>
          <Text className='basic-field-label'>希望育见怎么帮到孩子</Text>
          <Textarea
            className='basic-field-textarea'
            placeholder='例如：少吼、作业开始前不那么僵、更懂他为什么抵触'
            placeholderClass='basic-field-placeholder'
            value={helpGoal}
            maxlength={500}
            autoHeight
            onInput={(e) => setHelpGoal(e.detail.value)}
          />
        </View>
      </View>
    </HiFiBuildShell>
  )
}
