import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const html = fs.readFileSync(path.join(root, 'design-reference/pages/index.full.html'), 'utf8')
const start = html.indexOf('const appPages = ')
const end = html.indexOf('];', start)
const arrText = html.slice(start + 'const appPages = '.length, end + 1)
const pages = JSON.parse(arrText)
const outDir = path.join(root, 'design-reference/extracted')
fs.mkdirSync(outDir, { recursive: true })

pages.forEach((page, i) => {
  const title = (page.match(/<title>([^<]+)/) || [])[1] || `page-${i}`
  const safe = title.replace(/[^\w\u4e00-\u9fff]+/g, '-').slice(0, 40)
  fs.writeFileSync(path.join(outDir, `${i}-${safe}.html`), page)
  const style = page.match(/<style>([\s\S]*?)<\/style>/)?.[1]
  if (style) fs.writeFileSync(path.join(outDir, `${i}-${safe}.css`), style)
  console.log(i, title, page.length)
})
