/** Family Understanding Dossier — schema v2（内部整合底稿，理论隐身） */

import type { EvidenceRef } from './database'

export type DossierFactor = {
  id?: string
  label: string
  confidence: number
  evidenceSummary?: string
  sceneNote?: string
}

export type DossierSceneReading = {
  scene: string
  protectiveMix?: Record<string, number>
  mainPerpetuatingId?: string
  reading: string
}

export type DossierParentPerspective = {
  role: string
  intent?: string
  childReception?: string
  actualImpact?: string
  blindSpot?: string
  receptivity?: number
}

export type DossierPredictionStatus = 'unverified' | 'failed' | 'verified'

export type DossierPrediction = {
  id: string
  text: string
  /** 默认 unverified；任务反馈/反证链可标 failed */
  status?: DossierPredictionStatus
  /** v4：0-1 数值置信度，区分高把握预测与低把握预测 */
  confidence?: number
  /** v4：预测依据的证据 id 引用，可回溯"依据哪条原话" */
  evidenceRefs?: EvidenceRef[]
}

export type DossierInterventionTarget = {
  id: string
  targets?: string[]
  action: string
  prediction?: string
  obstacle?: string
}

export type DossierAlternativeReading = {
  id: string
  hypothesis: string
  confidence: number
  distinguishingEvidence?: string
}

export type FamilyUnderstandingDossier = {
  version: number
  changeLog: string[]
  familyStruct: DossierFactor[]
  fivePs: {
    presenting?: string
    predisposing?: DossierFactor[]
    precipitating?: DossierFactor[]
    perpetuating?: DossierFactor[]
    protective?: DossierFactor[]
  }
  sceneReadings: DossierSceneReading[]
  parentPerspectives: DossierParentPerspective[]
  workingHypothesis: {
    text: string
    predictions?: DossierPrediction[]
  }
  interventionTargets: DossierInterventionTarget[]
  integratedSynthesis: string
  alternativeReadings?: DossierAlternativeReading[]
  /** 内部段，不进 dossierSlice */
  ecologicalCalibration?: string
  evidenceLedger?: string[]
  updatedAt: string
}

export const EMPTY_DOSSIER: FamilyUnderstandingDossier = {
  version: 0,
  changeLog: [],
  familyStruct: [],
  fivePs: {},
  sceneReadings: [],
  parentPerspectives: [],
  workingHypothesis: { text: '' },
  interventionTargets: [],
  integratedSynthesis: '',
  updatedAt: '',
}
