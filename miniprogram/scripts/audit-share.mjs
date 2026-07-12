#!/usr/bin/env node
/**
 * 分享能力审计：页面 config + 页面级 hook（Taro 编译后写入 index.js）
 * 用法：npm run build:weapp && node scripts/audit-share.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const srcRoot = path.join(root, 'src')
const distRoot = path.join(root, 'dist')

function listPageConfigs(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    if (!fs.statSync(full).isDirectory()) continue
    const cfg = path.join(full, 'index.config.ts')
    const page = path.join(full, 'index.tsx')
    if (fs.existsSync(cfg) && fs.existsSync(page)) acc.push({ cfg, page, rel: path.relative(srcRoot, full) })
    listPageConfigs(full, acc)
  }
  return acc
}

const pages = [
  ...listPageConfigs(path.join(srcRoot, 'pages')),
  ...listPageConfigs(path.join(srcRoot, 'packageOnboarding', 'pages')),
]

const missingConfig = []
const missingHook = []
const missingDist = []

for (const { cfg, page, rel } of pages) {
  const cfgText = fs.readFileSync(cfg, 'utf8')
  if (!cfgText.includes('enableShareAppMessage') || !cfgText.includes('enableShareTimeline')) {
    missingConfig.push(rel)
  }
  const pageText = fs.readFileSync(page, 'utf8')
  const hasHook =
    /usePublicPageShare|useSafeShareAppMessage|useEnableShareAppMessage|useDisableShareAppMessage/.test(
      pageText
    )
  if (!hasHook) missingHook.push(rel)

  const distJs = path.join(distRoot, rel, 'index.js')
  if (fs.existsSync(distJs)) {
    const js = fs.readFileSync(distJs, 'utf8')
    if (!js.includes('enableShareAppMessage') || !js.includes('enableShareTimeline')) {
      missingDist.push(rel)
    }
  } else {
    missingDist.push(`${rel} (no dist)`)
  }
}

console.log(`审计 ${pages.length} 个页面\n`)

let ok = true
if (missingConfig.length === 0) {
  console.log('✓ index.config.ts 均已 enableShareAppMessage + enableShareTimeline')
} else {
  ok = false
  console.log('✗ 缺少 page config 分享开关:')
  missingConfig.forEach((p) => console.log('  -', p))
}

if (missingHook.length === 0) {
  console.log('✓ 页面组件均已注册分享 hook')
} else {
  ok = false
  console.log('✗ 缺少 usePublicPageShare / useSafeShareAppMessage:')
  missingHook.forEach((p) => console.log('  -', p))
}

if (missingDist.length === 0) {
  console.log('✓ dist/index.js 已注入分享配置（Taro Page 注册）')
} else {
  ok = false
  console.log('✗ dist 未注入分享（需先 build:weapp）:')
  missingDist.forEach((p) => console.log('  -', p))
}

process.exit(ok ? 0 : 1)
