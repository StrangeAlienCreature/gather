'use client'

import { useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Step indicator dots ───────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex justify-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === current ? '20px' : '6px',
            background:
              i === current
                ? 'white'
                : i < current
                ? 'rgba(255,255,255,0.5)'
                : 'rgba(255,255,255,0.25)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function WelcomePage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Pull group details passed from the get-started page via query params
  const groupName = searchParams.get('groupName') ?? 'Your Group'
  const slug = searchParams.get('slug') ?? ''
  const code = searchParams.get('code') ?? '------'
  const userId = searchParams.get('userId') ?? ''

  const [step, setStep] = useState(0)
  const TOTAL_STEPS = 4

  // Step 1 state
  const [displayName, setDisplayName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Derive initials from display name for avatar placeholder
  const initials = displayName.trim()
    ? displayName
        .trim()
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0].toUpperCase())
        .slice(0, 2)
        .join('')
    : '?'

  // Handle photo file selection
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  // Save display name (and optionally photo) to Supabase, then advance
  async function handleProfileSave() {
    if (!displayName.trim()) {
      setError('Please enter a display name.')
      return
    }
    setSaving(true)
    setError('')

    try {
      let photoUrl: string | null = null

      // Upload photo to Supabase Storage if one was chosen
      if (avatarFile && userId) {
        const ext = avatarFile.name.split('.').pop()
        const path = `${userId}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }

      // Update the users row with display name and photo
      if (userId) {
        const updates: Record<string, string> = {
          display_name: displayName.trim(),
        }
        if (photoUrl) updates.profile_photo = photoUrl

        const { error: dbError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', userId)

        if (dbError) throw dbError
      }

      nextStep()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function nextStep() {
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  }

  // ── Shared card style ────────────────────────────────────────────────────────
  const cardClass =
    'w-full max-w-lg rounded-2xl p-8 border border-white/20 bg-gradient-to-b from-orange-400/60 via-pink-500/60 to-violet-700/80'

  // ── Shared input style ───────────────────────────────────────────────────────
  const inputClass =
    'w-full h-10 px-3 rounded-lg text-sm text-white placeholder-white/50 bg-white/15 border border-white/30 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20'

  const btnPrimary =
    'w-full h-11 rounded-lg text-sm font-medium bg-white text-violet-700 hover:opacity-90 transition-opacity cursor-pointer'

  const btnSecondary =
    'flex-1 h-11 rounded-lg text-sm font-medium text-white bg-white/15 border border-white/30 hover:bg-white/25 transition-colors cursor-pointer'

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">

      {/* Logo */}
      <div className="mb-10">
        <Image src="/Asset 1.png" alt="Gather" width={120} height={38} className="object-contain" />
      </div>

      <div className={cardClass}>
        <StepDots current={step} total={TOTAL_STEPS} />

        {/* ── Step 1: Profile setup ─────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-widest mb-1">
              Step 1 of 4
            </p>
            <h2 className="text-2xl font-medium text-white tracking-tight mb-1">
              Set up your profile
            </h2>
            <p className="text-[15px] text-white/80 leading-relaxed mb-7">
              Your group members will see this when you plan things together.
            </p>

            {/* Avatar */}
            <div className="flex flex-col items-center gap-3 mb-7">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-22 h-22 rounded-full border-2 border-dashed border-white/50 hover:border-white bg-white/15 flex items-center justify-center overflow-hidden transition-colors cursor-pointer"
                style={{ width: 88, height: 88 }}
              >
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Avatar preview"
                    width={88}
                    height={88}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-medium text-white">
                    {initials}
                  </span>
                )}
              </button>
              <span className="text-[13px] text-white/75">Tap to add a photo</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {/* Display name */}
            <div className="flex flex-col gap-1.5 mb-5">
              <label className="text-[13px] font-medium text-white/85">
                Display name
              </label>
              <input
                type="text"
                className={inputClass}
                placeholder="How your friends will know you"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setError('')
                }}
              />
              {error && (
                <p className="text-[13px] text-white/80 mt-1">{error}</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleProfileSave}
              disabled={saving}
              className={btnPrimary}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>

            <p className="text-center mt-3">
              <button
                type="button"
                onClick={nextStep}
                className="text-[13px] text-white/60 underline underline-offset-4 hover:text-white/90 cursor-pointer"
              >
                Skip photo for now
              </button>
            </p>
          </div>
        )}

        {/* ── Step 2: Group confirmation ────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-widest mb-1">
              Step 2 of 4
            </p>
            <h2 className="text-2xl font-medium text-white tracking-tight mb-1">
              Your group is live
            </h2>
            <p className="text-[15px] text-white/80 leading-relaxed mb-7">
              Here's a quick look at what was set up. You can edit all of this
              from the dashboard.
            </p>

            <div className="rounded-xl border border-white/20 bg-white/15 p-5 mb-6 flex flex-col gap-3">
              {[
                { label: 'Group name', value: groupName },
                {
                  label: 'URL',
                  value: (
                    <span className="text-white/70 text-[13px]">
                      gather.app/
                      <strong className="text-white">{slug}</strong>
                    </span>
                  ),
                },
                {
                  label: 'Invite code',
                  value: (
                    <span className="font-mono text-[13px] text-white bg-white/20 px-2 py-0.5 rounded">
                      {code}
                    </span>
                  ),
                },
                { label: 'Members', value: '1 of 12' },
              ].map((row, i, arr) => (
                <div key={row.label}>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-white/75">{row.label}</span>
                    <span className="text-[13px] font-medium text-white">
                      {row.value}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="mt-3 h-px bg-white/15" />
                  )}
                </div>
              ))}
            </div>

            <button type="button" onClick={nextStep} className={btnPrimary}>
              Looks good
            </button>
          </div>
        )}

        {/* ── Step 3: Next steps checklist ─────────────────────────────────── */}
        {step === 2 && (
          <div>
            <p className="text-xs font-medium text-white/70 uppercase tracking-widest mb-1">
              Step 3 of 4
            </p>
            <h2 className="text-2xl font-medium text-white tracking-tight mb-1">
              Things to do first
            </h2>
            <p className="text-[15px] text-white/80 leading-relaxed mb-7">
              A few quick things to get your group up and running.
            </p>

            <div className="flex flex-col gap-2.5 mb-7">
              {[
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                      <circle cx="8" cy="6" r="2.5" />
                      <path d="M3 13.5c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
                    </svg>
                  ),
                  title: 'Invite your friends',
                  desc: `Share the code ${code} or send a direct link`,
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                      <rect x="2" y="3" width="12" height="11" rx="2" />
                      <path d="M5 3V1.5M11 3V1.5M2 7h12" />
                    </svg>
                  ),
                  title: 'Create your first event',
                  desc: 'Add a date, location, and things to know',
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M8 2v4l3 3" />
                      <circle cx="8" cy="9" r="6" />
                    </svg>
                  ),
                  title: 'Set your availability',
                  desc: "Let the group know when you're typically free",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-white/20 bg-white/15 hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-white">{item.title}</p>
                    <p className="text-[12px] text-white/75">{item.desc}</p>
                  </div>
                  <span className="text-white/50 text-base">›</span>
                </div>
              ))}
            </div>

            <button type="button" onClick={nextStep} className={btnPrimary}>
              Continue
            </button>
          </div>
        )}

        {/* ── Step 4: Final CTA ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="14" cy="14" r="11" />
                <path d="M9 14l3.5 3.5L19 10" />
              </svg>
            </div>

            <h2 className="text-2xl font-medium text-white tracking-tight text-center mb-1">
              You're all set
            </h2>
            <p className="text-[15px] text-white/80 leading-relaxed text-center mb-8">
              Where do you want to start?
            </p>

            <div className="flex gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => router.push(`/invite?slug=${slug}&code=${code}`)}
                className={btnSecondary}
              >
                Invite friends
              </button>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/${slug}`)}
                className="flex-1 h-11 rounded-lg text-sm font-medium bg-white text-violet-700 hover:opacity-90 transition-opacity cursor-pointer"
              >
                Go to dashboard
              </button>
            </div>

            <p className="text-center">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/${slug}?action=create-event`)}
                className="text-[13px] text-white/60 underline underline-offset-4 hover:text-white/90 cursor-pointer"
              >
                Create my first event instead ›
              </button>
            </p>
          </div>
        )}
      </div>
    </main>
  )
}