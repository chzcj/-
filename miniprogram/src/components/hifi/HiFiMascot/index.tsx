import { Image, View } from '@tarojs/components'
import mascot from '../../../assets/hifi-mascot.png'
import './index.scss'

export function HiFiMascot() {
  return (
    <View className='mascot'>
      <Image className='mascot-img' src={mascot} mode='aspectFit' />
    </View>
  )
}
