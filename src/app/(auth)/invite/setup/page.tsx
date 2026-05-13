'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Home, Users, Copy, Check, Loader2 } from 'lucide-react'

export default function InviteSetupPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [loading, setLoading] = useState(false)
  const [householdName, setHouseholdName] = useState('Our Household')
  const [inviteCode, setInviteCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [copied, setCopied] = useState(false)

  async function createHousehold() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Not signed in'); setLoading(false); return }

    const { data, error } = await supabase
      .from('households')
      .insert({ name: householdName, user1_id: user.id })
      .select()
      .single()

    if (error || !data) {
      console.error('createHousehold error:', error)
      toast.error(error?.message || 'Failed to create household')
      setLoading(false)
      return
    }

    await supabase
      .from('profiles')
      .update({ household_id: data.id })
      .eq('id', user.id)

    setInviteCode(data.invite_code)
    setLoading(false)
    setMode('create')
  }

  async function joinHousehold() {
    if (joinCode.trim().length !== 8) {
      toast.error('Invite code must be 8 characters')
      return
    }
    setLoading(true)
    const { data, error } = await supabase.rpc('join_household', { p_invite_code: joinCode.trim() })
    setLoading(false)

    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error || 'Failed to join household')
      return
    }
    toast.success('Joined household!')
    router.push('/dashboard')
    router.refresh()
  }

  async function copyInviteLink() {
    const link = `${window.location.origin}/invite/${inviteCode}`
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🏠</div>
            <h1 className="text-2xl font-bold">Set Up Your Household</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Create a shared space with your friend
            </p>
          </div>
          <Card
            className="cursor-pointer hover:border-indigo-400 transition-colors"
            onClick={() => setMode('create')}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Home className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold">Create a Household</p>
                <p className="text-sm text-muted-foreground">Start fresh and invite your friend</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:border-amber-400 transition-colors"
            onClick={() => setMode('join')}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold">Join with a Code</p>
                <p className="text-sm text-muted-foreground">Enter your friend&apos;s invite code</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (mode === 'join') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Join a Household</CardTitle>
            <CardDescription>Enter the 8-character code from your friend</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="code">Invite Code</Label>
              <Input
                id="code"
                placeholder="e.g. a1b2c3d4"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toLowerCase())}
                maxLength={8}
                className="font-mono text-lg tracking-widest text-center"
              />
            </div>
            <Button onClick={joinHousehold} className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Household
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setMode('choose')}>
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Create mode
  if (inviteCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🎉</div>
            <CardTitle>Household Created!</CardTitle>
            <CardDescription>Share this code with your friend</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-zinc-100 rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Invite Code</p>
              <p className="text-3xl font-mono font-bold tracking-widest text-indigo-600">
                {inviteCode}
              </p>
            </div>
            <Button onClick={copyInviteLink} variant="outline" className="w-full">
              {copied ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </Button>
            <Button onClick={() => { router.push('/dashboard'); router.refresh() }} className="w-full">
              Continue to Dashboard
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Your friend can join at any time using this code
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Name Your Household</CardTitle>
          <CardDescription>Choose a name for your shared space</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hname">Household Name</Label>
            <Input
              id="hname"
              placeholder="Our Household"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
            />
          </div>
          <Button onClick={createHousehold} className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Household
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setMode('choose')}>
            Back
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
