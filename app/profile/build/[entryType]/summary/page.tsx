import { notFound, redirect } from 'next/navigation'
import { EntrySummaryPage } from '@/components/profile/EntrySummaryPage'
import { LEGACY_ENTRY_ROUTE, normalizeBuildEntryType } from '@/lib/profile/buildEntries'

export default function BuildEntrySummaryPage({ params }: { params: { entryType: string } }) {
  const legacy = LEGACY_ENTRY_ROUTE[params.entryType]
  if (legacy) redirect(`/profile/build/${legacy}/summary`)

  const entryType = normalizeBuildEntryType(params.entryType)
  if (!entryType) notFound()

  return <EntrySummaryPage entryType={entryType} />
}
