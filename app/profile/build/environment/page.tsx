import { redirect } from 'next/navigation'

export default function LegacyEnvironmentRedirect() {
  redirect('/profile/build/family')
}
