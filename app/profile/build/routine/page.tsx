import { redirect } from 'next/navigation'

export default function LegacyRoutineRedirect() {
  redirect('/profile/build/daily')
}
