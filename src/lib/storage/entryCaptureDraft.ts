import type { EntryType } from '@/types/storage'

const PREFIX = 'childos.entry.capture.'

type CaptureDraft = {
  draft: string
  promptIndex: number
}

function key(entryType: EntryType) {
  return `${PREFIX}${entryType}`
}

export function loadEntryCaptureDraft(entryType: EntryType): CaptureDraft {
  if (typeof window === 'undefined') return { draft: '', promptIndex: 0 }
  try {
    const raw = sessionStorage.getItem(key(entryType))
    if (!raw) return { draft: '', promptIndex: 0 }
    const parsed = JSON.parse(raw) as CaptureDraft
    return {
      draft: typeof parsed.draft === 'string' ? parsed.draft : '',
      promptIndex: typeof parsed.promptIndex === 'number' ? parsed.promptIndex : 0,
    }
  } catch {
    return { draft: '', promptIndex: 0 }
  }
}

export function saveEntryCaptureDraft(entryType: EntryType, data: CaptureDraft) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(key(entryType), JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function clearEntryCaptureDraft(entryType: EntryType) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(key(entryType))
  } catch {
    /* ignore */
  }
}
