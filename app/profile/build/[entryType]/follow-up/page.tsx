import { notFound, redirect } from 'next/navigation'
import { EntryFollowUpPage } from '@/components/profile/EntryFollowUpPage'
import { LEGACY_ENTRY_ROUTE, normalizeBuildEntryType } from '@/lib/profile/buildEntries'

export default function BuildEntryFollowUpPage({ params }: { params: { entryType: string } }) {
  const legacy = LEGACY_ENTRY_ROUTE[params.entryType]
  if (legacy) redirect(`/profile/build/${legacy}/follow-up`)

  const entryType = normalizeBuildEntryType(params.entryType)
  if (!entryType) notFound()

  return <EntryFollowUpPage entryType={entryType} />
}
