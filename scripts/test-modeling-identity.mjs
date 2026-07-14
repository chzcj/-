#!/usr/bin/env node
/** 校验 secondMeCollaboratorIdentity §A+§C 抽取不含前台 §B */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const full = fs.readFileSync(
  path.join(ROOT, 'prompts/core/secondMeCollaboratorIdentity.md'),
  'utf8'
)

function extractModelingIdentityPrefix(fullIdentity) {
  const aMatch = fullIdentity.match(/## A\.\s*公共使命[\s\S]*?(?=\n## B\.|$)/)
  const cMatch = fullIdentity.match(/## C\.\s*后台附加[\s\S]*$/)
  const parts = [aMatch?.[0]?.trim(), cMatch?.[0]?.trim()].filter(Boolean)
  if (parts.length === 0) return fullIdentity.trim()
  return parts.join('\n\n')
}

const prefix = extractModelingIdentityPrefix(full)
const ok =
  prefix.includes('公共使命') &&
  prefix.includes('后台附加') &&
  !prefix.includes('## B.') &&
  prefix.includes('SecondMe')

console.log(ok ? '✓ modeling identity extract OK' : '✗ modeling identity extract FAILED')
console.log(`  prefix chars: ${prefix.length}`)
process.exit(ok ? 0 : 1)
