import type { MaturityLevel, EntryName, ContextMaturityState } from '@/types/database'
import { determineMaturityLevel } from '@/lib/server/constitution'
import type { TenantId } from '@/lib/server/memory/tenant'

const DEFAULT_FAMILY_ID = 'f_demo'
const DEFAULT_CHILD_ID = 'c_demo'

export function getCurrentMaturityState(tenant?: TenantId): ContextMaturityState {
  const now = new Date().toISOString()
  const familyId = tenant?.familyId || DEFAULT_FAMILY_ID
  const childId = tenant?.childId || DEFAULT_CHILD_ID

  if (typeof window === 'undefined') {
    return {
      familyId,
      childId,
      level: 'L0',
      entryCompletion: {
        learning_homework: false,
        daily_rhythm_phone: false,
        parent_child_communication: false,
        emotional_stress: false,
        relationship_environment: false
      },
      hasProfile: false,
      hasStableProfile: false,
      hypothesisCount: 0,
      dailyInteractionCount: 0,
      updatedAt: now
    }
  }

  try {
    const raw = localStorage.getItem('childos.v1')
    if (!raw) {
      return {
        familyId: DEFAULT_FAMILY_ID,
        childId: DEFAULT_CHILD_ID,
        level: 'L0',
        entryCompletion: {
          learning_homework: false,
          daily_rhythm_phone: false,
          parent_child_communication: false,
          emotional_stress: false,
          relationship_environment: false
        },
        hasProfile: false,
        hasStableProfile: false,
        hypothesisCount: 0,
        dailyInteractionCount: 0,
        updatedAt: now
      }
    }

    const storage = JSON.parse(raw)

    const buildSessions = storage.buildSessions || []
    const activeSession = buildSessions[buildSessions.length - 1]

    const entryCompletion: Record<EntryName, boolean> = {
      learning_homework: false,
      daily_rhythm_phone: false,
      parent_child_communication: false,
      emotional_stress: false,
      relationship_environment: false
    }

    if (activeSession && activeSession.completedEntries) {
      for (const entry of activeSession.completedEntries) {
        const mapped = mapLegacyEntryToNew(entry as string)
        if (mapped) entryCompletion[mapped] = true
      }
    }

    const profileSnapshots = storage.profileSnapshots || []
    const hasProfile = profileSnapshots.length > 0

    const dailyObservations = storage.dailyObservations || []
    const interactionCount = dailyObservations.length

    const level = determineMaturityLevel(entryCompletion, hasProfile, interactionCount)

    return {
      familyId: storage.activeFamilyId || DEFAULT_FAMILY_ID,
      childId: storage.activeChildId || DEFAULT_CHILD_ID,
      level,
      entryCompletion,
      hasProfile,
      hasStableProfile: hasProfile && level === 'L4',
      hypothesisCount: (storage.verificationPoints || []).length,
      dailyInteractionCount: interactionCount,
      lastInteractionAt: dailyObservations[dailyObservations.length - 1]?.createdAt,
      updatedAt: now
    }
  } catch {
    return {
      familyId: DEFAULT_FAMILY_ID,
      childId: DEFAULT_CHILD_ID,
      level: 'L0',
      entryCompletion: {
        learning_homework: false,
        daily_rhythm_phone: false,
        parent_child_communication: false,
        emotional_stress: false,
        relationship_environment: false
      },
      hasProfile: false,
      hasStableProfile: false,
      hypothesisCount: 0,
      dailyInteractionCount: 0,
      updatedAt: now
    }
  }
}

function mapLegacyEntryToNew(legacy: string): EntryName | null {
  const mapping: Record<string, EntryName> = {
    study: 'learning_homework',
    routine: 'daily_rhythm_phone',
    communication: 'parent_child_communication',
    emotion: 'emotional_stress',
    environment: 'relationship_environment'
  }
  return mapping[legacy] || null
}

export function getMaturityLevel(): MaturityLevel {
  return getCurrentMaturityState().level
}

export function isMatureEnoughForDiagnosis(): boolean {
  const state = getCurrentMaturityState()
  return state.level === 'L2' || state.level === 'L3' || state.level === 'L4'
}

export function isMatureEnoughForSynthesis(): boolean {
  const state = getCurrentMaturityState()
  return state.level === 'L2' || state.level === 'L3' || state.level === 'L4'
}

export function shouldDefaultToFollowup(): boolean {
  return getMaturityStateWithDefault().shouldDefaultToFollowup
}

function getMaturityStateWithDefault() {
  const level = getMaturityLevel()
  return {
    level,
    shouldDefaultToFollowup: level === 'L0',
    canDeepDiagnose: level !== 'L0' && level !== 'L1',
    canSynthesize: level !== 'L0' && level !== 'L1'
  }
}
