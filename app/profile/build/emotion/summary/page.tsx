import { redirect } from 'next/navigation'

export default function LegacyEmotionSummaryRedirect() {
  redirect('/profile/build/communication/summary')
}
