import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(scriptDir, '..')
const scope = '.hifi-build-root'
const srcPath = path.join(root, 'design-reference/hifi-build.css')
const outPath = path.join(root, 'app/profile/build/hifi-build.css')
const mascotAsset = '/assets/hifi-mascot.png'

const raw = fs.readFileSync(srcPath, 'utf8')

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

const overrides = `
/* Overrides: app-only + isolate from globals.css */
${scope} .hifi-top-bar-visible {
  display: none !important;
}

${scope} .hifi-page-back {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  margin: 0 0 12px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(255, 255, 255, 0.8);
}

${scope} .primary-button,
${scope} .secondary-button,
${scope} .quiet-button,
${scope} .chip {
  border-radius: var(--radius-pill);
}

${scope} .bottom-actions .primary-button,
${scope} .bottom-actions .secondary-button,
${scope} .bottom-actions .quiet-button {
  width: 100%;
  min-height: 48px;
}

${scope} .hifi-bottom-actions {
  position: relative;
  z-index: 30;
  flex-shrink: 0;
  pointer-events: auto;
}

${scope} .page {
  position: relative;
  z-index: 1;
}

${scope} .hero-card.compact.has-mascot,
${scope} .hero-card.has-mascot {
  min-height: 206px;
  padding: 26px 28px;
  align-content: center;
}

${scope} .hero-card.has-mascot::before {
  background:
    radial-gradient(circle at 80% 46%, rgba(155, 214, 110, 0.48), transparent 34%),
    radial-gradient(circle at 84% 28%, rgba(248, 237, 159, 0.72), transparent 23%),
    radial-gradient(circle at 10% 10%, rgba(255, 250, 220, 0.96), transparent 44%);
}

${scope} .hero-card.has-mascot .hero-title,
${scope} .hero-card.has-mascot .hero-copy,
${scope} .hero-card.has-mascot .module-kicker {
  width: 62%;
  position: relative;
  z-index: 1;
}

${scope} .hero-card.has-mascot .hero-title {
  font-size: var(--text-hero);
  line-height: 1.32;
  width: min(56%, calc(100% - 148px));
}

${scope} .hero-card.has-mascot .hero-copy {
  margin-top: 10px;
  line-height: var(--text-body-lh);
  width: min(54%, calc(100% - 148px));
}

${scope} .mascot {
  width: 164px;
  height: 146px;
  position: absolute;
  right: 2px;
  bottom: 0;
  overflow: hidden;
  background: url("${mascotAsset}") center bottom / contain no-repeat;
  filter: drop-shadow(0 14px 18px rgba(75, 139, 68, 0.12));
  z-index: 0;
  pointer-events: none;
}

${scope} .face-eye,
${scope} .face-mouth {
  display: none;
}

${scope} .entry-list {
  display: grid;
  gap: 10px;
}

${scope} .entry-row {
  width: 100%;
  text-align: left;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-radius: var(--radius-row);
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
}

${scope} .entry-row.completed {
  opacity: 0.92;
}

${scope} .entry-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-control);
  display: grid;
  place-items: center;
  color: var(--green-deep);
  background: linear-gradient(180deg, #fbf0b8, #eef7cf);
}

${scope} .entry-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

${scope} .entry-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 720;
  color: var(--ink);
}

${scope} .entry-desc {
  font-size: var(--text-small);
  line-height: var(--text-small-lh);
  color: var(--ink-soft);
}

${scope} .entry-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 650;
  color: var(--muted);
}

${scope} .entry-status.status-completed {
  color: var(--green-deep);
}

${scope} .hifi-voice-error {
  margin: 10px 0 0;
  color: #c0392b;
  font-size: 13px;
  font-weight: 650;
}

${scope} .hifi-voice-live {
  margin: 8px 0 0;
  color: var(--green-deep);
  font-size: 14px;
  line-height: 1.55;
  font-weight: 650;
}

${scope} .flow-steps {
  display: grid;
  gap: 8px;
}

${scope} .flow-step {
  min-height: 38px;
  border-radius: var(--radius-control);
  display: grid;
  place-items: center;
  color: var(--green-deep);
  background: var(--green-soft);
  font-size: 13px;
  font-weight: 740;
  text-align: center;
  opacity: 0.55;
}

${scope} .flow-step.done,
${scope} .flow-step.active {
  opacity: 1;
}

${scope} .flow-arrow {
  color: var(--green-deep);
  text-align: center;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
}

${scope} .primary-button:focus-visible,
${scope} .secondary-button:focus-visible,
${scope} .quiet-button:focus-visible,
${scope} .chip:focus-visible,
${scope} .entry-row:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

${scope} .soft-card p,
${scope} .summary-card p,
${scope} .profile-block p {
  font-size: var(--text-small);
  line-height: var(--text-small-lh);
}

.login-root .app-shell.startup-gate {
  width: min(100%, 430px);
  max-width: 100vw;
  height: 100dvh;
  margin: 0 auto;
  display: grid;
  grid-template-rows: 1fr;
  padding: 0 42px calc(38px + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 75% 12%, rgba(171, 221, 108, 0.26), transparent 31%),
    radial-gradient(circle at 12% 8%, rgba(247, 231, 143, 0.36), transparent 30%),
    #f8f6e9;
}
`

const scoped = `/* Auto-scoped from design-reference/hifi-build.css — do not edit by hand */\n${scopeCss(raw, scope)}\n${overrides}\n`
fs.writeFileSync(outPath, scoped)
console.log('[scope-hifi-build-css] wrote', outPath, scoped.length, 'bytes')
