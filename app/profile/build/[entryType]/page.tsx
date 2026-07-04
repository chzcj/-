import { notFound, redirect } from 'next/navigation'
import { EntryCapturePage } from '@/components/profile/EntryCapturePage'
import { LEGACY_ENTRY_ROUTE, normalizeBuildEntryType } from '@/lib/profile/buildEntries'

export default function BuildEntryCapturePage({ params }: { params: { entryType: string } }) {
  const legacy = LEGACY_ENTRY_ROUTE[params.entryType]
  if (legacy) redirect(`/profile/build/${legacy}`)

  const entryType = normalizeBuildEntryType(params.entryType)
  if (!entryType) notFound()

  return <EntryCapturePage entryType={entryType} />
}
