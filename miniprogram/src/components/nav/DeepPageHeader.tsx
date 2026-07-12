import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './DeepPageHeader.scss'

type Props = {
  title: string
  /** 返回落点：默认 navigateBack，失败则 switchTab 预演 */
  onBack?: () => void
  /** 全屏任务页右上角关闭 */
  showClose?: boolean
  onClose?: () => void
}

export function DeepPageHeader({ title, onBack, showClose, onClose }: Props) {
  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      void Taro.navigateBack()
    } else {
      void Taro.switchTab({ url: '/pages/rehearsal/index' })
    }
  }

  const handleClose = () => {
    if (onClose) {
      onClose()
      return
    }
    void Taro.switchTab({ url: '/pages/rehearsal/index' })
  }

  return (
    <View className='deep-page-header'>
      <Text className='deep-page-back' onClick={handleBack}>
        ← 返回
      </Text>
      <Text className='deep-page-title'>{title}</Text>
      {showClose ? (
        <Text className='deep-page-close' onClick={handleClose}>
          关闭
        </Text>
      ) : (
        <View className='deep-page-close-spacer' />
      )}
    </View>
  )
}
