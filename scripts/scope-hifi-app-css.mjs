import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..')
const raw = fs.readFileSync(path.join(root, 'design-reference/extracted/2-main-app.css'), 'utf8')
const scope = '.hifi-app-root'
const mascotAsset = '/assets/hifi-mascot.png'
const mascotPath = path.join(root, 'public/assets/hifi-mascot.png')

function ensureMascotAsset() {
  if (fs.existsSync(mascotPath)) return
  const m = raw.match(/\.mascot\s*\{[^}]*background:\s*url\("(data:image[^"]+)"\)/s)
  if (!m) {
    console.warn('[scope-hifi-app-css] mascot base64 not found in reference CSS')
    return
  }
  const [, dataUrl] = m
  const [, dataB64] = dataUrl.split(',', 2)
  fs.mkdirSync(path.dirname(mascotPath), { recursive: true })
  fs.writeFileSync(mascotPath, Buffer.from(dataB64, 'base64'))
  console.log('[scope-hifi-app-css] wrote', mascotPath)
}

ensureMascotAsset()

const src = raw.replace(/url\("data:image[^"]+"\)/g, `url("${mascotAsset}")`)

function scopeRuleBlock(selectors, scopeClass) {
  return selectors
    .split(',')
    .map((rawSel) => {
      const s = rawSel.trim()
      if (!s) return s
      if (s === 'html' || s === 'body' || s === 'html, body') return scopeClass
      if (s.startsWith('html ') || s.startsWith('body ')) return `${scopeClass}${s.slice(4)}`
      if (s === '*') return `${scopeClass} *`
      if (s.startsWith(':root')) return s.replace(':root', scopeClass)
      return `${scopeClass} ${s}`
    })
    .join(', ')
}

function scopeCss(css, scopeClass) {
  let out = ''
  let i = 0
  const len = css.length

  while (i < len) {
    while (i < len && /\s/.test(css[i])) i++
    if (i >= len) break

    if (css[i] === '@') {
      const brace = css.indexOf('{', i)
      const header = css.slice(i, brace + 1)
      if (header.startsWith('@keyframes')) {
        const close = findClose(css, brace)
        out += `${css.slice(i, close + 1)}\n`
        i = close + 1
        continue
      }
      if (header.startsWith('@media') || header.startsWith('@supports')) {
        const close = findClose(css, brace)
        const inner = css.slice(brace + 1, close)
        out += `${header}${scopeCss(inner, scopeClass)}}\n`
        i = close + 1
        continue
      }
      const close = findClose(css, brace)
      out += `${css.slice(i, close + 1)}\n`
      i = close + 1
      continue
    }

    const brace = css.indexOf('{', i)
    if (brace < 0) break
    const selectors = css.slice(i, brace)
    const close = findClose(css, brace)
    const body = css.slice(brace + 1, close)

    if (selectors.includes('html') || selectors.includes('body')) {
      if (/overflow:\s*hidden/.test(body) && selectors.trim().startsWith('html')) {
        i = close + 1
        continue
      }
    }

    out += `${scopeRuleBlock(selectors, scopeClass)}{${body}}\n`
    i = close + 1
  }

  return out
}

function findClose(css, openBrace) {
  let depth = 0
  for (let i = openBrace; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return css.length - 1
}

const overrides = `
/* Overrides: isolate from globals.css + polish layer */
${scope} {
  --radius-card: 24px;
  --radius-row: 20px;
  --radius-control: 16px;
  --radius-inner: 12px;
  --text-body: 15px;
  --text-body-lh: 1.68;
  --text-small: 13px;
  --text-small-lh: 1.55;
  --text-title: 17px;
  --text-hero: 26px;
}

${scope} .page {
  min-height: 0;
  scroll-behavior: auto;
  padding: 12px 20px 20px;
  scroll-padding-bottom: 16px;
}

${scope} .hero-card.compact {
  min-height: auto;
  padding: 22px 24px;
}

${scope} .hero-card.compact .hero-title,
${scope} .hero-card.compact .hero-copy {
  width: min(56%, calc(100% - 148px));
}

${scope} .bubble-reply {
  font-size: var(--text-body);
  line-height: var(--text-body-lh);
  text-wrap: pretty;
  color: var(--ink);
}

${scope} .bubble-reply + .bubble-section,
${scope} .bubble-reply + .suggestion-strip {
  margin-top: 12px;
}

${scope} .bubble-reply + .bubble-section {
  padding-top: 0;
  border-top: none;
}

${scope} .bubble-section + .suggestion-strip {
  margin-top: 14px;
}

${scope} .thinking-panel + .bubble-reply {
  margin-top: 12px;
}

${scope} .bubble-section.section-reveal {
  animation: section-reveal 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  ${scope} .bubble-section.section-reveal {
    animation: none;
  }
}

${scope} .suggestion-strip {
  margin-top: 14px;
}

${scope} .suggestion-strip .pill {
  min-height: 34px;
  padding: 7px 13px;
  font-size: 14px;
  font-weight: 720;
}

@keyframes section-reveal {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

${scope} .profile-chip {
  animation: none;
}

${scope} .thinking-bubble .bubble-reply:empty {
  display: none;
}

${scope} .quiet-button {
  min-height: 36px;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  color: var(--green-deep);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(111, 159, 86, 0.14);
  font-size: var(--text-small);
  font-weight: 720;
  line-height: 1.4;
}

${scope} .quiet-button:disabled {
  opacity: 0.55;
}

${scope} .primary-button,
${scope} .secondary-button,
${scope} .pill,
${scope} .choice-button,
${scope} .tag {
  border-radius: var(--radius-pill);
  transition: transform 160ms var(--ease-out-quart), background-color 160ms ease-out, color 160ms ease-out, box-shadow 160ms ease-out;
}

${scope} .pill:active:not(:disabled),
${scope} .choice-button:active:not(:disabled),
${scope} .primary-button:active:not(:disabled),
${scope} .secondary-button:active:not(:disabled),
${scope} .tab-button:active:not(.active),
${scope} .hold-button:active:not(:disabled),
${scope} .mode-button:active:not(:disabled),
${scope} .send-button:active:not(:disabled),
${scope} .profile-settings-button:active {
  transform: scale(0.97);
}

${scope} .pill:focus-visible,
${scope} .choice-button:focus-visible,
${scope} .primary-button:focus-visible,
${scope} .secondary-button:focus-visible,
${scope} .tab-button:focus-visible,
${scope} .hold-button:focus-visible,
${scope} .mode-button:focus-visible,
${scope} .send-button:focus-visible,
${scope} .profile-settings-button:focus-visible,
${scope} .quiet-button:focus-visible,
${scope} .text-input:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

${scope} .profile-settings-row {
  position: relative;
  z-index: 2;
}

${scope} .settings-overlay,
${scope} .family-menu {
  border-radius: inherit;
}

${scope} .task-title,
${scope} .profile-block h3,
${scope} .scenario-title,
${scope} .rehearsal-header h2 {
  letter-spacing: -0.01em;
}

${scope} .profile-block p,
${scope} .profile-block li,
${scope} .task-source,
${scope} .scenario-desc {
  font-size: var(--text-small);
  line-height: var(--text-small-lh);
}

${scope} .profile-data-card {
  cursor: pointer;
  transition: outline-color 160ms ease-out, box-shadow 160ms ease-out;
}

${scope} .profile-data-card h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

${scope} .card-chevron {
  flex-shrink: 0;
  font-size: 14px;
  color: var(--muted);
  line-height: 1;
}

${scope} .profile-data-card.expanded {
  outline: 2px solid rgba(111, 166, 95, 0.28);
}

${scope} .card-progress-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

${scope} .progress-bar-track {
  height: 6px;
  border-radius: var(--radius-pill);
  background: rgba(111, 159, 86, 0.12);
  overflow: hidden;
}

${scope} .progress-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--green-deep), var(--green));
  transition: width 280ms var(--ease-out-quart);
}

${scope} .progress-hint {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink-soft);
}

/* Tasks: meta row bottom-align + status pill / caret */
${scope} .task-meta {
  align-items: flex-end;
  min-height: 30px;
}

${scope} .task-meta .task-source {
  display: flex;
  align-items: flex-end;
  min-height: 30px;
  margin: 0;
  flex: 1;
  min-width: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1;
  user-select: none;
  -webkit-user-select: none;
}

${scope} .status-tag {
  flex-shrink: 0;
  height: 30px;
  min-height: 30px;
  padding: 0 11px;
  border: 1px solid transparent;
  line-height: 1;
  appearance: none;
  -webkit-appearance: none;
  font-family: inherit;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.16s var(--ease-out-quart), opacity 0.16s ease;
}

${scope} .status-tag:active {
  transform: scale(0.97);
}

${scope} .status-tag.saving {
  opacity: 0.72;
  pointer-events: none;
}

${scope} .status-tag .status-text {
  display: inline-flex;
  align-items: center;
  line-height: 1;
  user-select: none;
  -webkit-user-select: none;
}

${scope} .status-tag--pending {
  color: var(--ink-soft);
  background: rgba(255, 255, 255, 0.84);
  border-color: rgba(73, 91, 45, 0.08);
  box-shadow: var(--shadow-soft);
}

${scope} .status-tag--progress {
  color: #8a7340;
  background: var(--butter-soft);
  border-color: rgba(138, 115, 64, 0.12);
}

${scope} .status-tag--done {
  color: var(--green-deep);
  background: var(--green-soft);
  border-color: rgba(111, 159, 86, 0.14);
}

${scope} .status-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border: none;
}

${scope} .status-caret::after {
  content: "";
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
}

${scope} .status-caret.up::after {
  border-bottom: 5px solid var(--muted);
}

${scope} .status-caret.down::after {
  border-top: 5px solid var(--muted);
}

${scope} .status-caret.up,
${scope} .status-caret.down {
  border-left: none;
  border-right: none;
  border-top: none;
  border-bottom: none;
}

/* Profile: white surface + structured card detail */
${scope}.surface-white .app-shell {
  background: #fff;
}

${scope}.surface-white .profile-data-card,
${scope}.surface-white .profile-block {
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 1px 3px rgba(29, 29, 31, 0.04);
}

${scope} .profile-card-summary {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--ink-soft);
}

${scope} .portrait-detail-card {
  display: grid;
  gap: 14px;
}

${scope} .portrait-detail-lead {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-body);
  line-height: 1.6;
  text-wrap: pretty;
}

${scope} .portrait-detail-section {
  padding-top: 4px;
}

${scope} .portrait-detail-heading {
  margin: 0 0 8px;
  color: var(--ink);
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

${scope} .portrait-detail-list {
  margin: 0;
  padding-left: 18px;
  color: var(--ink-soft);
  font-size: var(--text-small);
  line-height: 1.55;
}

${scope} .portrait-detail-list li + li {
  margin-top: 6px;
}

${scope} .portrait-detail-facts {
  margin-top: 4px;
  padding: 12px 14px;
  border-radius: var(--radius-control);
  background: rgba(29, 29, 31, 0.03);
  border: 1px solid var(--line);
}

${scope} .portrait-detail-facts h3 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 650;
  color: var(--ink);
}

${scope} .portrait-detail-facts ul {
  margin: 0;
  padding-left: 18px;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.55;
}

${scope} .authority-badge {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  letter-spacing: 0.02em;
}

@media (prefers-reduced-motion: reduce) {
  ${scope} .page.page-entering .hero-card,
  ${scope} .page.page-entering .section,
  ${scope} .page.page-entering .task-card,
  ${scope} .page.page-entering .profile-block,
  ${scope} .page.page-entering .profile-data-card,
  ${scope} .page.page-entering .flow-card,
  ${scope} .page.page-entering .feedback-panel,
  ${scope} .page.page-entering .scenario-card,
  ${scope} .page.page-entering .rehearsal-header,
  ${scope} .message-row,
  ${scope} .thinking-dots i,
  ${scope} .wave span,
  ${scope} .profile-chip {
    animation: none !important;
  }

  ${scope} .tab-button:active:not(.active),
  ${scope} .pill:active:not(:disabled),
  ${scope} .primary-button:active:not(:disabled) {
    transform: none;
  }
}
`

const scoped = `/* Auto-scoped from design-reference/extracted/2-main-app.css */\n${scopeCss(src, scope)}\n${overrides}\n`
fs.writeFileSync(path.join(root, 'app/hifi-app.css'), scoped)
console.log('wrote app/hifi-app.css', scoped.length, 'bytes')
