'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function InviteCodePage() {
  const { code } = useParams<{ code: string }>()
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [householdName, setHouseholdName] = useState<string | null>(null)

  useEffect(() => {
    async function checkAuth() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/login?redirect=/invite/${code}`)
        return
      }

      // Check if already in a household
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()

      if (profile?.household_id) {
        router.push('/dashboard')
        return
      }

      // Preview household name
      const { data: household } = await supabase
        .from('households')
        .select('name')
        .eq('invite_code', code)
        .single()

      setHouseholdName(household?.name ?? null)
      setLoading(false)
    }
    checkAuth()
  }, [code, supabase, router])

  async function handleJoin() {
    setJoining(true)
    const { data, error } = await supabase.rpc('join_household', { p_invite_code: code })
    setJoining(false)

    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error || 'Failed to join')
      return
    }
    toast.success('Welcome to the household!')
    router.push('/dashboard')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (!householdName) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="p-6">
            <p className="text-lg font-semibold">Invalid invite code</p>
            <p className="text-muted-foreground text-sm mt-1">This invite link may have expired or is incorrect.</p>
            <Button className="mt-4" onClick={() => router.push('/invite/setup')}>
              Go to Setup
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🤝</div>
          <CardTitle>You&apos;re Invited!</CardTitle>
          <CardDescription>Join &quot;{householdName}&quot; on Owey</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleJoin} className="w-full" disabled={joining}>
            {joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Accept Invitation
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => router.push('/dashboard')}>
            Decline
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
