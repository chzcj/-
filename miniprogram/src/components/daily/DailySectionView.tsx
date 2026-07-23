import { View, Text } from '@tarojs/components'
import type { DailySection } from '@yujian/contracts'
import { AuthorityInsightCard } from '@/components/hifi/AuthorityInsightCard'
import { parseStreamingSectionBody } from '@/lib/parseStreamingSection'
import { stripParentFacingMarkdown } from '@/lib/textDisplay'

const AUTHORITY_SECTION_IDS = new Set(['diagnosis_headline', 'this_time'])

function sectionPlainBody(section: DailySection): string {
  if (section.streamingText) return section.streamingText
  const parts = [
    ...(section.paragraphs || []),
    ...(section.items || []),
    ...(section.quotes || []),
    section.note || '',
  ].filter(Boolean)
  return stripParentFacingMarkdown(parts.join('\n'))
}

function SectionBody({ section }: { section: DailySection }) {
  if (AUTHORITY_SECTION_IDS.has(section.id) && !section.streamingText) {
    const body = sectionPlainBody(section)
    if (body.trim()) {
      return <AuthorityInsightCard title={section.label} body={body} />
    }
  }

  if (section.streamingText !== undefined && section.streamingText !== '') {
    const parsed = parseStreamingSectionBody(section.streamingText, section.kind)
    const hasStructured = parsed.paragraphs || parsed.items || parsed.quotes
    if (hasStructured) {
      return (
        <View className='section-body section-body-streaming'>
          {parsed.paragraphs?.map((p, i) => (
            <Text key={i} className='section-body-para'>
              {stripParentFacingMarkdown(p)}
            </Text>
          ))}
          {parsed.items?.map((item) => (
            <Text key={item} className='bubble-list-item'>
              · {stripParentFacingMarkdown(item)}
            </Text>
          ))}
          {parsed.quotes?.map((q) => (
            <Text key={q} className='quote-line'>
              「{stripParentFacingMarkdown(q)}」
            </Text>
          ))}
        </View>
      )
    }
    return (
      <View className='section-body section-body-streaming'>
        <Text className='section-body-para'>{stripParentFacingMarkdown(section.streamingText)}</Text>
      </View>
    )
  }

  return (
    <View className='section-body'>
      {section.paragraphs?.map((p, i) => (
        <Text key={i} className='section-body-para'>
          {stripParentFacingMarkdown(p)}
        </Text>
      ))}
      {section.items?.map((item) => (
        <Text key={item} className='bubble-list-item'>
          · {stripParentFacingMarkdown(item)}
        </Text>
      ))}
      {section.quotes?.map((q) => (
        <Text key={q} className='quote-line'>
          「{stripParentFacingMarkdown(q)}」
        </Text>
      ))}
      {section.note ? <Text className='section-footnote'>{stripParentFacingMarkdown(section.note)}</Text> : null}
    </View>
  )
}

type DailySectionViewProps = {
  section: DailySection
  hasError?: boolean
  onRetry?: () => void
  animate?: boolean
}

export function DailySectionView({ section, hasError, onRetry, animate }: DailySectionViewProps) {
  return (
    <View className={`bubble-section${animate ? ' section-reveal' : ''}`} data-section-id={section.id}>
      {!AUTHORITY_SECTION_IDS.has(section.id) || section.streamingText ? (
        <Text className='section-label'>{section.label}</Text>
      ) : null}
      {hasError && onRetry ? (
        <View className='section-error-block'>
          <Text className='section-error-text'>这部分未生成</Text>
          <Text className='pill' onClick={onRetry}>
            重试
          </Text>
        </View>
      ) : (
        <SectionBody section={section} />
      )}
    </View>
  )
}
