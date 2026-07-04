#!/usr/bin/env node
/**
 * Regression checks for classifySafetyTier.
 * Run: node --experimental-strip-types scripts/test-safety-tier.mjs
 */
import { classifySafetyTier } from '../src/lib/server/daily/safety-tier.ts'

const cases = [
  {
    text: '他说了一句我印象很深：快点写完也没用，后面肯定还有别的。我当时听了挺火的，因为那些背诵订正本来就是他该做的，不是我故意加。但他这样讲，说明他心里一直是这么想的。',
    expect: 'none',
    id: 'daily_002_homework_quote',
  },
  {
    text: '做完也没用，后面还有背诵和订正',
    expect: 'none',
    id: 'task_frustration',
  },
  {
    text: '他说不想活了，我吓坏了',
    expect: 'critical',
    id: 'critical_keyword',
  },
  {
    text: '今天风险小一点，能洗澡能正常睡，没有再说负面话',
    expect: 'relief_followup',
    id: 'relief_followup',
  },
  {
    text: '我觉得自己一点用都没有',
    expect: 'elevated',
    id: 'self_worth_distress',
  },
  {
    text: '活着真没意思',
    expect: 'elevated',
    id: 'living_meaningless',
  },
]

let failed = 0

for (const c of cases) {
  const got = classifySafetyTier(c.text)
  if (got !== c.expect) {
    console.error(`FAIL ${c.id}: expected ${c.expect}, got ${got}`)
    failed++
  } else {
    console.log(`ok ${c.id}`)
  }
}

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log(`\nAll ${cases.length} safety-tier cases passed.`)
