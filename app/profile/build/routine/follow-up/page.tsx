import { redirect } from 'next/navigation'

export default function LegacyRoutineFollowUpRedirect() {
  redirect('/profile/build/daily/follow-up')
}
