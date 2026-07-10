#!/usr/bin/env node
/**
 * Round3 视觉 parity 静态审计：对照 DESIGN-TOKENS.md 与关键组件 class。
 * 用法：npm run style-parity-audit
 * 输出：docs/style-parity-report.md
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'docs/style-parity-report.md')

function read(rel) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) return ''
  return fs.readFileSync(abs, 'utf8')
}

function hasAll(content, patterns) {
  return patterns.every((p) => content.includes(p))
}

const tokenChecks = [
  {
    id: 'T-green-deep',
    severity: 'P1',
    label: '品牌绿 $green-deep',
    file: 'src/styles/tokens.scss',
    patterns: ['$green-deep: #6f9f56'],
  },
  {
    id: 'T-btn-primary',
    severity: 'P1',
    label: '主按钮高度 52px',
    file: 'src/styles/tokens.scss',
    patterns: ['$btn-height-primary: 52px'],
  },
  {
    id: 'T-input-dock',
    severity: 'P0',
    label: '输入区占位高度',
    file: 'src/styles/tokens.scss',
    patterns: ['$input-dock-height: 72px', '$tab-bar-height'],
  },
  {
    id: 'T-bubble-ratio',
    severity: 'P1',
    label: '气泡宽度比例',
    file: 'src/styles/tokens.scss',
    patterns: ['$bubble-parent-max-ratio: 72%', '$bubble-ai-max: 86%'],
  },
]

const classChecks = [
  {
    id: 'C-hold-button',
    severity: 'P0',
    label: '交流按住说话',
    file: 'src/components/hifi/HiFiInputZone/index.scss',
    patterns: ['.hold-button'],
  },
  {
    id: 'C-record-box',
    severity: 'P0',
    label: 'Onboarding record-box',
    file: 'src/styles/hifi-build.scss',
    patterns: ['.record-box', '.record-area', '.hold-chip'],
  },
  {
    id: 'C-page-shell',
    severity: 'P0',
    label: '单滚动壳层占位',
    file: 'src/styles/hifi-base.scss',
    patterns: ['.page--with-input', '.page--with-tab'],
  },
  {
    id: 'C-input-dock',
    severity: 'P0',
    label: '交流输入区 fixed dock',
    file: 'src/components/hifi/HiFiMainShell/index.scss',
    patterns: ['.input-dock'],
  },
  {
    id: 'C-tab-bar',
    severity: 'P1',
    label: '自定义 TabBar',
    file: 'src/custom-tab-bar/index.scss',
    patterns: ['.bottom-tabs', '.tab-button'],
  },
  {
    id: 'C-profile-card',
    severity: 'P1',
    label: '画像 Tab 数据卡',
    file: 'src/pages/profile/index.scss',
    patterns: ['.profile-data-card', '.progress-hint'],
  },
  {
    id: 'C-checkpoint',
    severity: 'P2',
    label: '预演 checkpoint',
    file: 'src/pages/rehearsal/index.scss',
    patterns: ['.checkpoint-backdrop', '.checkpoint-card'],
  },
  {
    id: 'C-motion',
    severity: 'P1',
    label: '动效库 page-rise / section-reveal',
    file: 'src/styles/motion.scss',
    patterns: ['@keyframes page-rise', '@keyframes section-reveal', '.page.page-entering'],
  },
]

const knownP2 = [
  { id: 'P2-font-weight', label: '字重 820→700', note: '微信 Text 无 820，见 visual-diff P1' },
  { id: 'P2-glass-blur', label: '玻璃态 blur', note: 'backdrop-filter 机型差异' },
  { id: 'P2-mascot-size', label: 'hifi-mascot.png 体积', note: '已压缩至 <120KB' },
  { id: 'P2-tab-svg', label: 'Tab SVG 图标', note: 'data-uri SVG 对齐 Web path' },
]

function runChecks(checks) {
  return checks.map((c) => {
    const content = read(c.file)
    const pass = content && hasAll(content, c.patterns)
    return { ...c, pass: Boolean(pass) }
  })
}

const tokenResults = runChecks(tokenChecks)
const classResults = runChecks(classChecks)
const failed = [...tokenResults, ...classResults].filter((r) => !r.pass)
const p0fail = failed.filter((r) => r.severity === 'P0')
const p1fail = failed.filter((r) => r.severity === 'P1')

const lines = [
  '# Style Parity Report',
  '',
  `生成时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')} (UTC)`,
  '',
  '基准：Web `app/hifi-app.css` / `hifi-build.css`，视口 390px。本报告为**静态 class/token 审计**，真机感知仍需人工对照。',
  '',
  '## 摘要',
  '',
  `- Token 检查：${tokenResults.filter((r) => r.pass).length}/${tokenResults.length} 通过`,
  `- 组件 class 检查：${classResults.filter((r) => r.pass).length}/${classResults.length} 通过`,
  `- P0 未通过：${p0fail.length}`,
  `- P1 未通过：${p1fail.length}`,
  '',
  '## Token 对照',
  '',
  '| ID | 级别 | 项 | 文件 | 结果 |',
  '|----|------|-----|------|------|',
  ...tokenResults.map(
    (r) => `| ${r.id} | ${r.severity} | ${r.label} | \`${r.file}\` | ${r.pass ? 'pass' : '**fail**'} |`
  ),
  '',
  '## 组件 Class 对照',
  '',
  '| ID | 级别 | 项 | 文件 | 结果 |',
  '|----|------|-----|------|------|',
  ...classResults.map(
    (r) => `| ${r.id} | ${r.severity} | ${r.label} | \`${r.file}\` | ${r.pass ? 'pass' : '**fail**'} |`
  ),
  '',
  '## 登记 P2（不阻断）',
  '',
  '| ID | 项 | 说明 |',
  '|----|-----|------|',
  ...knownP2.map((p) => `| ${p.id} | ${p.label} | ${p.note} |`),
  '',
]

if (failed.length) {
  lines.push('## 待修复项', '')
  for (const f of failed) {
    lines.push(`- **${f.severity}** ${f.label}（\`${f.file}\`）缺少：${f.patterns.map((p) => `\`${p}\``).join(', ')}`)
  }
  lines.push('')
} else {
  lines.push('## 待修复项', '', '无 P0/P1 静态项失败。', '')
}

lines.push(
  '## 建议人工验收页面',
  '',
  '1. `/daily` — hold-button、气泡 72%/86%、thinking 四宫格',
  '2. `capture` — record-box 184px 感知高度、wave 动画',
  '3. `/profile` — 画像数据中心卡片与进度条',
  '4. `/rehearsal` — scenario-grid、checkpoint 弹层',
  '5. 真机 ASR — 按住说话 + socket 白名单',
  ''
)

fs.writeFileSync(OUT, lines.join('\n'))
console.log(`Wrote ${OUT}`)
console.log(`P0 fail: ${p0fail.length}, P1 fail: ${p1fail.length}`)
process.exit(p0fail.length > 0 ? 1 : 0)
