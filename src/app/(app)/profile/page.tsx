'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHousehold } from '@/context/HouseholdContext'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getInitials } from '@/lib/utils'
import { LogOut, Copy, Check, Users, Link as LinkIcon, Home, UserCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const { currentUser, household, partner } = useHousehold()
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function copyCode() {
    await navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    toast.success('Invite code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyLink() {
    const link = `${window.location.origin}/invite/${household.invite_code}`
    await navigator.clipboard.writeText(link)
    setLinkCopied(true)
    toast.success('Invite link copied!')
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div className="pb-8">
      {/* Hero */}
      <div className="bg-white border-b border-zinc-100 px-4 pt-6 pb-8 flex flex-col items-center gap-3">
        <Avatar className="h-20 w-20">
          <AvatarFallback
            style={{ backgroundColor: currentUser.avatar_color }}
            className="text-white text-2xl font-bold"
          >
            {getInitials(currentUser.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h1 className="text-xl font-bold">{currentUser.display_name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{household.name}</p>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">

        {/* Household card */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Household</p>
          <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-100">
            <div className="flex items-center gap-3 p-4">
              <Home className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{household.name}</p>
                <p className="text-xs text-muted-foreground">Household name</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4">
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              {partner ? (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{partner.display_name}</p>
                    <p className="text-xs text-muted-foreground">Friend in household</p>
                  </div>
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback
                      style={{ backgroundColor: partner.avatar_color }}
                      className="text-white text-xs font-semibold"
                    >
                      {getInitials(partner.display_name)}
                    </AvatarFallback>
                  </Avatar>
                </>
              ) : (
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-600">No friend yet</p>
                  <p className="text-xs text-muted-foreground">Share the invite code to add someone</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Invite section */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            {partner ? 'Household Code' : 'Invite a Friend'}
          </p>
          <div className="bg-white rounded-xl border border-zinc-100 p-4 space-y-3">
            {!partner && (
              <p className="text-sm text-muted-foreground">Share this code or link so your friend can join your household.</p>
            )}
            <div className="flex items-center gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="font-mono font-bold text-xl tracking-widest text-indigo-600 flex-1 text-center">
                {household.invite_code}
              </p>
              <button
                onClick={copyCode}
                className="p-2 rounded-lg hover:bg-zinc-200 transition-colors flex-shrink-0"
              >
                {copied
                  ? <Check className="h-4 w-4 text-emerald-500" />
                  : <Copy className="h-4 w-4 text-zinc-500" />
                }
              </button>
            </div>
            {!partner && (
              <Button variant="outline" className="w-full" onClick={copyLink}>
                <LinkIcon className="mr-2 h-4 w-4" />
                {linkCopied ? 'Link Copied!' : 'Copy Invite Link'}
              </Button>
            )}
          </div>
        </section>

        {/* Account section */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Account</p>
          <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-100">
            <div className="flex items-center gap-3 p-4">
              <UserCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{currentUser.display_name}</p>
                <p className="text-xs text-muted-foreground">Display name</p>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        <Button
          variant="destructive"
          className="w-full h-12"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
