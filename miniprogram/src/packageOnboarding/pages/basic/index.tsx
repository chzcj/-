import { View, Text, Input, Picker, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useState } from 'react'
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

const RELATION_CHIPS = ['妈妈', '爸爸', '奶奶', '爷爷', '外婆', '外公'] as const

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

function buildStatusCopy(run: ProfileBuildRunState | null): string {
  if (run?.status === 'succeeded') {
    return '画像已经整理好了。补完下面几项，就可以去看首版 Second Me。'
  }
  if (run?.status === 'running' && run.label?.trim()) {
    return `${run.label} 您先填写，我们会在后台继续整理。`
  }
  return '这几项会帮助后面的交流、任务和预演更贴近你家；不会改动刚才四段讲述里的理解。'
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

  const heroCopy = useMemo(() => buildStatusCopy(buildRun), [buildRun])

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
      Taro.showToast({ title: '还有几项没填完', icon: 'none' })
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
      topTitle='补充日常资料'
      stepLabel='最后一步'
      progress={96}
      actions={[{ label: saving ? '保存中…' : '完成，去看画像', onClick: () => void next(), disabled: saving }]}
    >
      <HiFiBuildHero
        kicker='四段讲述已完成'
        title='再回答几个日常小问题'
        copy={heroCopy}
        compact
        mascot={false}
      />

      <View className='basic-form'>
        <View className='basic-section'>
          <Text className='basic-section-lead'>关于孩子</Text>
          <Text className='basic-section-hint'>称呼和年级会让后面的建议更有分寸。</Text>
          <View className='basic-group-card'>
            <View className='basic-field-block'>
              <Text className='basic-field-label'>平时怎么称呼 TA？</Text>
              <Input
                className='basic-field-input'
                type='text'
                placeholder='例如：小树'
                placeholderClass='basic-field-placeholder'
                value={childName}
                maxlength={20}
                onInput={(e) => setChildName(e.detail.value)}
              />
            </View>
            <View className='basic-field-divider' />
            <View className='basic-field-row'>
              <View className='basic-field-block basic-field-block--half'>
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
                    <Text className='basic-picker-chevron' aria-hidden>›</Text>
                  </View>
                </Picker>
              </View>
              <View className='basic-field-divider basic-field-divider--vertical' />
              <View className='basic-field-block basic-field-block--half'>
                <Text className='basic-field-label'>所在省份</Text>
                <Picker
                  mode='selector'
                  range={[...PROVINCES]}
                  value={provinceIndex >= 0 ? provinceIndex : 0}
                  onChange={(e) => setProvince(PROVINCES[Number(e.detail.value)] || '')}
                >
                  <View className='basic-picker-value'>
                    <Text className={province ? 'basic-picker-text basic-picker-text--clamp' : 'basic-field-placeholder'}>
                      {province || '请选择'}
                    </Text>
                    <Text className='basic-picker-chevron' aria-hidden>›</Text>
                  </View>
                </Picker>
              </View>
            </View>
          </View>
        </View>

        <View className='basic-section'>
          <Text className='basic-section-lead'>关于您</Text>
          <Text className='basic-section-hint'>方便理解您平时怎么陪、最希望改变什么。</Text>
          <View className='basic-group-card'>
            <View className='basic-field-block'>
              <Text className='basic-field-label'>您和孩子的关系</Text>
              <View className='basic-relation-chips'>
                {RELATION_CHIPS.map((chip) => (
                  <View
                    key={chip}
                    className={`basic-relation-chip${caregiverRelation === chip ? ' is-active' : ''}`}
                    onClick={() => setCaregiverRelation(chip)}
                  >
                    <Text>{chip}</Text>
                  </View>
                ))}
              </View>
              <Input
                className='basic-field-input basic-field-input--relation'
                type='text'
                placeholder='也可以自己填写，例如：姑姑'
                placeholderClass='basic-field-placeholder'
                value={caregiverRelation}
                maxlength={40}
                onInput={(e) => setCaregiverRelation(e.detail.value)}
              />
            </View>
            <View className='basic-field-divider' />
            <View className='basic-field-block'>
              <Text className='basic-field-label'>平时大概怎么陪孩子？</Text>
              <Textarea
                className='basic-field-textarea'
                placeholder='例如：工作日晚上聊一会儿，周末上午一起出门'
                placeholderClass='basic-field-placeholder'
                value={companionTime}
                maxlength={200}
                autoHeight
                onInput={(e) => setCompanionTime(e.detail.value)}
              />
            </View>
            <View className='basic-field-divider' />
            <View className='basic-field-block'>
              <Text className='basic-field-label'>最希望育见帮您什么？</Text>
              <Textarea
                className='basic-field-textarea'
                placeholder='例如：作业前少僵、更懂他为什么抵触、吵完怎么修复'
                placeholderClass='basic-field-placeholder'
                value={helpGoal}
                maxlength={500}
                autoHeight
                onInput={(e) => setHelpGoal(e.detail.value)}
              />
            </View>
          </View>
        </View>
      </View>
    </HiFiBuildShell>
  )
}
