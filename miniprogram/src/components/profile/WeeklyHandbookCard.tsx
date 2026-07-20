import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { WeeklyHandbook, TimeCapsuleTeaser, MemoryFeedItem } from '@/lib/handbookPack'
import { FEED_TYPE_LABEL } from '@/lib/handbookPack'
import './WeeklyHandbookCard.scss'

type Props = {
  handbook: WeeklyHandbook | null
  timeCapsule: TimeCapsuleTeaser | null
  previewItems?: MemoryFeedItem[]
  onOpenHandbook?: () => void
  onOpenMemories?: () => void
  onOpenTimeCapsule?: () => void
}

function previewTitle(item: MemoryFeedItem) {
  return item.displayLine || item.title || item.keyword
}

export function WeeklyHandbookCard({
  handbook,
  timeCapsule,
  previewItems = [],
  onOpenHandbook,
  onOpenMemories,
  onOpenTimeCapsule,
}: Props) {
  const weekLabel = handbook?.weekRangeLabel || '近7天'
  const isEmpty = handbook?.source === 'empty' || handbook?.source === 'fallback'
  const coverBlurb =
    handbook?.coverBlurb ||
    '交流、任务反馈与随笔会在这里收成可回看的一周记忆。'
  const hasPreview = previewItems.length > 0

  const openPreview = (id: string, e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.()
    void Taro.navigateTo({ url: `/pages/profile/memory-detail/index?id=${encodeURIComponent(id)}` })
  }

  return (
    <>
      <View className='weekly-handbook' onClick={onOpenHandbook}>
        <View className='handbook-cover'>
          <Text className='handbook-month'>{weekLabel}</Text>
          <Text className='handbook-headline'>{handbook?.headline || '近7天还在积累记忆'}</Text>
          <Text className='handbook-blurb'>{coverBlurb}</Text>
        </View>
        <View className='handbook-body'>
          {hasPreview ? (
            <View className='hb-preview-list'>
              {previewItems.slice(0, 3).map((item) => (
                <View
                  key={item.id}
                  className='hb-preview-row'
                  onClick={(e) => openPreview(item.id, e)}
                >
                  <Text className='hb-preview-line'>{previewTitle(item)}</Text>
                  <Text className='hb-preview-type'>{FEED_TYPE_LABEL[item.type]}</Text>
                </View>
              ))}
            </View>
          ) : isEmpty ? (
            <View className='handbook-empty-inline'>
              <Text className='handbook-empty-inline-line'>
                手账记的是值得回看的瞬间，不是所有聊天记录
              </Text>
            </View>
          ) : (
            <>
              <View className='hb-row'>
                <Text className='hb-row-label'>阶段性亮点</Text>
                <Text className='hb-row-text'>
                  {handbook?.highlight || '继续记录后，亮点会出现在这里。'}
                </Text>
              </View>
              <View className='hb-row'>
                <Text className='hb-row-label'>关系瞬间</Text>
                <Text className='hb-row-text'>
                  {handbook?.relationMoment || '语音与随笔里的关系瞬间会在这里汇总。'}
                </Text>
              </View>
              <View className='hb-row hb-row--link' onClick={onOpenTimeCapsule}>
                <Text className='hb-row-label'>对比上次</Text>
                <Text className='hb-row-text'>
                  {handbook?.compareLastWeek || '积累足够记忆后，可与上一阶段对比回看。'}
                </Text>
              </View>
            </>
          )}
          <View
            className='cta-handbook'
            onClick={(e) => {
              e.stopPropagation?.()
              onOpenMemories?.()
            }}
          >
            <Text>查看近7天记忆</Text>
          </View>
        </View>
      </View>

      {timeCapsule ? (
        <View className='years-ago' onClick={onOpenTimeCapsule}>
          <View className='years-stamp'>
            <Text>对比{'\n'}上次</Text>
          </View>
          <View className='years-txt'>
            <Text className='years-title'>{timeCapsule.teaserTitle}</Text>
            <Text className='years-sub'>{timeCapsule.teaserSubtitle}</Text>
          </View>
        </View>
      ) : null}
    </>
  )
}
