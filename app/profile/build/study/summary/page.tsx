import { redirect } from 'next/navigation'

export default function LegacyStudySummaryRedirect() {
  redirect('/profile/build/homework/summary')
}
