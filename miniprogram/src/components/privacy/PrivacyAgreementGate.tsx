import { useEffect, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import {
  agreePrivacyAuthorization,
  disagreePrivacyAuthorization,
  initPrivacyAuthorization,
  openPrivacyContract,
  subscribePrivacyModal,
} from '@/lib/wechatPrivacy'
import './PrivacyAgreementGate.scss'

const AGREE_BUTTON_ID = 'privacy-agree-btn'

export function PrivacyAgreementGate() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    initPrivacyAuthorization()
    return subscribePrivacyModal(setVisible)
  }, [])

  if (!visible) return null

  return (
    <View className='privacy-gate'>
      <View className='privacy-gate__mask' />
      <View className='privacy-gate__panel'>
        <Text className='privacy-gate__title'>用户隐私保护提示</Text>
        <Text className='privacy-gate__copy'>
          为提供「按住说话」语音输入，我们需要使用麦克风录音。请阅读并同意
          <Text className='privacy-gate__link' onClick={openPrivacyContract}>
            《用户隐私保护指引》
          </Text>
          后继续。
        </Text>
        <View className='privacy-gate__actions'>
          <Button className='privacy-gate__btn privacy-gate__btn--ghost' onClick={disagreePrivacyAuthorization}>
            暂不使用
          </Button>
          <Button
            id={AGREE_BUTTON_ID}
            className='privacy-gate__btn privacy-gate__btn--primary'
            openType='agreePrivacyAuthorization'
            onAgreePrivacyAuthorization={() => agreePrivacyAuthorization(AGREE_BUTTON_ID)}
          >
            同意并继续
          </Button>
        </View>
      </View>
    </View>
  )
}
