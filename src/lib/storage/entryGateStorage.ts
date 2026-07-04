import type { BuildEntryType } from '@/lib/profile/buildEntries'

export type EntryFollowUpPayload = {
  shouldAsk: boolean
  purpose: string
  directions: string[]
  voicePrompt: string
}

function gateKey(entryType: BuildEntryType) {
  return `entry_gate_${entryType}`
}

export function saveEntryGate(entryType: BuildEntryType, payload: EntryFollowUpPayload) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(gateKey(entryType), JSON.stringify(payload))
}

export function loadEntryGate(entryType: BuildEntryType): EntryFollowUpPayload | null {
  if (typeof sessionStorage === 'undefined') return null
  const raw = sessionStorage.getItem(gateKey(entryType))
  if (!raw) return null
  try {
    return JSON.parse(raw) as EntryFollowUpPayload
  } catch {
    return null
  }
}

export function clearEntryGate(entryType: BuildEntryType) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(gateKey(entryType))
}
