import { Image, View } from '@tarojs/components'

type IconProps = {
  active?: boolean
}

function stroke(active?: boolean) {
  return active ? '#6f9f56' : 'rgba(91, 96, 106, 0.72)'
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function TabSvgIcon({ svg, active }: { svg: string; active?: boolean }) {
  return (
    <View className='tab-icon'>
      <Image className='tab-icon-img' src={svgDataUri(svg)} mode='aspectFit' />
    </View>
  )
}

export function ChatIcon({ active }: IconProps) {
  const c = stroke(active)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none"><path d="M14 5.4c-5.25 0-9.35 3.45-9.35 7.78 0 2.18 1.05 4.12 2.78 5.52l-.6 3.9 3.78-2.12c1.04.34 2.18.52 3.39.52 5.25 0 9.35-3.45 9.35-7.82S19.25 5.4 14 5.4z" stroke="${c}" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.5 13.15h.01M14 13.15h.01M17.5 13.15h.01" stroke="${c}" stroke-width="2.7" stroke-linecap="round"/></svg>`
  return <TabSvgIcon svg={svg} active={active} />
}

export function TasksIcon({ active }: IconProps) {
  const c = stroke(active)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none"><path d="M10.2 5.9H8.1a2.2 2.2 0 0 0-2.2 2.2v14.1a2.2 2.2 0 0 0 2.2 2.2h11.8a2.2 2.2 0 0 0 2.2-2.2V8.1a2.2 2.2 0 0 0-2.2-2.2h-2.1" stroke="${c}" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.3 3.7h5.4c.6 0 1.1.5 1.1 1.1v2.6c0 .6-.5 1.1-1.1 1.1h-5.4c-.6 0-1.1-.5-1.1-1.1V4.8c0-.6.5-1.1 1.1-1.1z" stroke="${c}" stroke-linejoin="round"/><path d="M10.4 15.1l2.55 2.55 5-5.25" stroke="${c}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  return <TabSvgIcon svg={svg} active={active} />
}

export function RehearsalIcon({ active }: IconProps) {
  const c = stroke(active)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none"><path d="M12.9 4.2l1.35 4.15a3.2 3.2 0 0 0 2.02 2.02l4.15 1.35-4.15 1.35a3.2 3.2 0 0 0-2.02 2.02l-1.35 4.15-1.35-4.15a3.2 3.2 0 0 0-2.02-2.02l-4.15-1.35 4.15-1.35a3.2 3.2 0 0 0 2.02-2.02L12.9 4.2z" stroke="${c}" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.65 16.3l.72 2.15a1.6 1.6 0 0 0 1.02 1.02l2.15.72-2.15.72a1.6 1.6 0 0 0-1.02 1.02l-.72 2.15-.72-2.15a1.6 1.6 0 0 0-1.02-1.02l-2.15-.72 2.15-.72a1.6 1.6 0 0 0 1.02-1.02l.72-2.15z" stroke="${c}" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  return <TabSvgIcon svg={svg} active={active} />
}

export function ProfileIcon({ active }: IconProps) {
  const c = stroke(active)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" fill="none"><path d="M14 24.4c5.74 0 10.4-4.66 10.4-10.4S19.74 3.6 14 3.6 3.6 8.26 3.6 14 8.26 24.4 14 24.4z" stroke="${c}"/><path d="M10.1 11.7h.01M17.9 11.7h.01" stroke="${c}" stroke-width="2.8" stroke-linecap="round"/><path d="M9.8 16.4c1.05 1.45 2.45 2.17 4.2 2.17s3.15-.72 4.2-2.17" stroke="${c}" stroke-linecap="round"/></svg>`
  return <TabSvgIcon svg={svg} active={active} />
}
