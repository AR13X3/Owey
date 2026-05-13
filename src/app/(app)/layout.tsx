import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { HouseholdProvider } from '@/context/HouseholdContext'
import { QueryProvider } from '@/context/QueryProvider'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'
import { Toaster } from 'sonner'
import type { Profile, Household } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: household }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .single()
      .then(async ({ data }) => {
        if (!data?.household_id) return { data: null }
        return supabase.from('households').select('*').eq('id', data.household_id).single()
      }),
  ])

  if (!profile?.household_id || !household) {
    redirect('/invite/setup')
  }

  const { data: partner } = await supabase
    .from('profiles')
    .select('*')
    .eq('household_id', profile.household_id)
    .neq('id', user.id)
    .single()

  return (
    <QueryProvider>
      <HouseholdProvider
        value={{
          currentUser: profile as Profile,
          partner: partner as Profile | null,
          household: household as Household,
        }}
      >
        <div className="min-h-screen bg-zinc-50 flex flex-col">
          <Header />
          <main className="flex-1 pb-nav overflow-x-hidden">
            {children}
          </main>
          <BottomNav />
        </div>
        <Toaster position="top-center" richColors />
      </HouseholdProvider>
    </QueryProvider>
  )
}
