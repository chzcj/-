/**
 * BP 产品截图脚本 — 使用真实线上 UI，390×844 移动端视口
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const BASE = 'https://yujian.yihe.site'
const SESSION = process.env.BP_SESSION_TOKEN || ''
const OUT = path.resolve('BP/images/产品截图')

const PAGES = [
  { file: '01-登录页.png', url: '/login', auth: false },
  { file: '02-onboarding-intro.png', url: '/profile/build/intro', auth: true },
  { file: '03-四模块采集hub.png', url: '/profile/build', auth: true },
  { file: '04-日常模块输入.png', url: '/profile/build/daily', auth: true },
  { file: '05-作业模块输入.png', url: '/profile/build/homework', auth: true },
  { file: '06-交流页.png', url: '/daily', auth: true, note: '需 onboarding 完成时才有内容' },
  { file: '07-画像页.png', url: '/family-profile', auth: true },
  { file: '08-任务页.png', url: '/tasks', auth: true },
  { file: '09-预演页.png', url: '/rehearsal', auth: true },
]

async function main() {
  if (!SESSION) {
    console.error('Set BP_SESSION_TOKEN')
    process.exit(1)
  }
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
  })
  await context.addCookies([
    {
      name: 'childos_session',
      value: SESSION,
      domain: 'yujian.yihe.site',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const page = await context.newPage()
  for (const item of PAGES) {
    const target = `${BASE}${item.url}`
    try {
      await page.goto(target, { waitUntil: 'networkidle', timeout: 45000 })
      await page.waitForTimeout(1500)
      await page.screenshot({ path: path.join(OUT, item.file), fullPage: false })
      console.log('OK', item.file, item.url)
    } catch (e) {
      console.error('FAIL', item.file, e.message)
    }
  }
  await browser.close()
}

main()
