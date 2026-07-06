#!/usr/bin/env node
/**
 * 深度建模链路审计：检查 entryFacts / matchedMechanisms / digest / portraitCards 非空率。
 * 用法：node scripts/audit-deep-modeling-pipeline.mjs [phone]
 */
import pg from 'pg'

const phone = process.argv[2] || process.env.AUDIT_PHONE || '12234567890'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL 未设置')
    process.exit(1)
  }
  const pool = new pg.Pool({ connectionString: url, max: 2 })
  try {
    const userRes = await pool.query(
      `SELECT family_id, child_id FROM users WHERE phone = $1 LIMIT 1`,
      [phone.replace(/\D/g, '')]
    )
    const row = userRes.rows[0]
    if (!row) {
      console.error(`未找到用户 phone=${phone}`)
      process.exit(1)
    }
    const { family_id: familyId, child_id: childId } = row

    const layers = await pool.query(
      `SELECT layer_name, data FROM memory_layer_items
       WHERE family_id = $1 AND child_id = $2
       AND layer_name IN ('built_profile_snapshots','deep_model_digest','daily_ui_snapshot','evidence_networks','deep_mechanism_handoffs')`,
      [familyId, childId]
    )

    const byLayer = Object.fromEntries(layers.rows.map((r) => [r.layer_name, r.data]))

    const built = byLayer.built_profile_snapshots
    const digest = byLayer.deep_model_digest
    const ui = byLayer.daily_ui_snapshot
    const network = byLayer.evidence_networks

    const handoff = byLayer.deep_mechanism_handoffs

    const mechanisms = network?.candidateMechanismMatrix?.length || 0
    const mechanismsWithEcosystem =
      network?.candidateMechanismMatrix?.filter((m) => m.ecosystemLayer).length || 0
    const tensionCount = digest?.structuralTensions?.length || handoff?.structuralTensions?.length || 0
    const digestFacts = digest?.anchoredFacts?.length || 0
    const portraitKeys = ui?.portraitCards
      ? Object.values(ui.portraitCards).filter((v) => String(v || '').replace(/\s/g, '').length >= 120).length
      : 0

    const report = {
      tenant: { familyId, childId },
      built: {
        hasCoreJudgment: Boolean(built?.coreJudgment?.trim()),
        hasDeepMechanism: Boolean(built?.deepMechanism?.trim()),
      },
      evidenceNetwork: { mechanismCount: mechanisms, mechanismsWithEcosystem },
      deepModelDigest: {
        hasNarrative: Boolean(digest?.mechanismNarrative?.trim()),
        anchoredFactCount: digestFacts,
        loopCount: digest?.interactionLoops?.length || 0,
        structuralTensionCount: tensionCount,
      },
      deepMechanismHandoff: {
        hasEcosystemMap: Boolean(handoff?.ecosystemMap?.length),
        theoryMatchCount: handoff?.theoryMatches?.length || 0,
      },
      dailyUiSnapshot: {
        portraitCardsRich: portraitKeys,
        source: ui?.source || null,
      },
      pass:
        Boolean(built?.coreJudgment?.trim()) &&
        (digestFacts > 0 || mechanisms > 0) &&
        portraitKeys >= 2,
    }

    console.log(JSON.stringify(report, null, 2))
    process.exit(report.pass ? 0 : 1)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
