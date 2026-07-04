import { redirect } from 'next/navigation'

export default function LegacyRoutineSummaryRedirect() {
  redirect('/profile/build/daily/summary')
}
