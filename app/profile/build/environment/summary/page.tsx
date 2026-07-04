import { redirect } from 'next/navigation'

export default function LegacyEnvironmentSummaryRedirect() {
  redirect('/profile/build/family/summary')
}
