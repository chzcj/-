const prefix = 'childos_build_draft_'

export function loadBuildTextDraft(key: string): string {
  if (typeof window === 'undefined') return ''
  try {
    return sessionStorage.getItem(`${prefix}${key}`) || ''
  } catch {
    return ''
  }
}

export function saveBuildTextDraft(key: string, text: string) {
  if (typeof window === 'undefined') return
  try {
    if (text.trim()) sessionStorage.setItem(`${prefix}${key}`, text)
    else sessionStorage.removeItem(`${prefix}${key}`)
  } catch {
    /* ignore */
  }
}

export function clearBuildTextDraft(key: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(`${prefix}${key}`)
  } catch {
    /* ignore */
  }
}
