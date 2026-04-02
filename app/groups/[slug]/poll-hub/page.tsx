'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Group {
  id: string
  name: string
  description: string
  code: string
  url_slug: string
  owner_id: string
  members: string[]
  max_members: number
}

interface LinkPreview {
  title: string
  description: string
  image: string
  domain: string
}

interface PollOption {
  label: string
  votes: string[]
  description?: string | null
  cost?: string | null
  url?: string | null
  preview?: LinkPreview | null
}

interface AvailabilityOptions {
  dates: string[]
  times: string[] | 'hourly'
  show_aggregate_only?: boolean
  members_can_update?: boolean
  responses?: Record<string, string[]>
}

interface Poll {
  id: string
  title: string
  description: string | null
  poll_type: string
  options: unknown
  voters: string[]
  expiry_date: string | null
  allow_multiple_votes: boolean
  is_anonymous: boolean
  created_by: string
  status: string
  created_date: string
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function PollHubPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const { slug } = params

  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Group | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [activePolls, setActivePolls] = useState<Poll[]>([])
  const [closedPolls, setClosedPolls] = useState<Poll[]>([])
  const [tab, setTab] = useState<'active' | 'closed'>('active')

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [availabilitySelections, setAvailabilitySelections] = useState<Record<string, string[]>>({})
  const [votingPollId, setVotingPollId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ pollId: string; type: 'close' | 'delete' } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setCurrentUserId(session.user.id)
      loadData(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/login')
    })
    return () => subscription.unsubscribe()
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData(userId: string) {
    setLoading(true)

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('url_slug', slug)
      .single()

    if (groupError || !groupData) { router.push('/'); return }
    if (!groupData.members.includes(userId)) { router.push('/'); return }

    setGroup(groupData)

    const [activeRes, closedRes] = await Promise.all([
      supabase.from('polls').select('*').eq('group_id', groupData.id).eq('status', 'active').order('created_date', { ascending: false }),
      supabase.from('polls').select('*').eq('group_id', groupData.id).eq('status', 'closed').order('created_date', { ascending: false }),
    ])

    setActivePolls(activeRes.data ?? [])
    setClosedPolls(closedRes.data ?? [])
    setLoading(false)
  }

  function toggleAvailabilityDate(pollId: string, dateStr: string) {
    setAvailabilitySelections((prev) => {
      const current = prev[pollId] ?? []
      const next = current.includes(dateStr)
        ? current.filter((d) => d !== dateStr)
        : [...current, dateStr]
      return { ...prev, [pollId]: next }
    })
  }

  async function handleVote(pollId: string, optionLabel: string) {
    if (!currentUserId || votingPollId) return
    setVotingPollId(pollId)
    const { data: pollData } = await supabase
      .from('polls')
      .select('options, voters')
      .eq('id', pollId)
      .single()
    if (pollData) {
      const updatedOptions = (pollData.options as PollOption[]).map((opt) =>
        opt.label === optionLabel
          ? { ...opt, votes: [...(opt.votes ?? []), currentUserId] }
          : opt
      )
      await supabase
        .from('polls')
        .update({ options: updatedOptions, voters: [...(pollData.voters ?? []), currentUserId] })
        .eq('id', pollId)
      await loadData(currentUserId)
    }
    setVotingPollId(null)
    setSelectedOptions((prev) => { const n = { ...prev }; delete n[pollId]; return n })
  }

  async function handleAvailabilityVote(pollId: string, dates: string[]) {
    if (!currentUserId || votingPollId) return
    setVotingPollId(pollId)
    const { data: pollData } = await supabase
      .from('polls')
      .select('options, voters')
      .eq('id', pollId)
      .single()
    if (pollData) {
      const opts = pollData.options as AvailabilityOptions
      const responses = { ...(opts.responses ?? {}), [currentUserId]: dates }
      await supabase
        .from('polls')
        .update({ options: { ...opts, responses }, voters: [...(pollData.voters ?? []), currentUserId] })
        .eq('id', pollId)
      await loadData(currentUserId)
    }
    setVotingPollId(null)
    setAvailabilitySelections((prev) => { const n = { ...prev }; delete n[pollId]; return n })
  }

  async function handleClosePoll(pollId: string) {
    await supabase.from('polls').update({ status: 'closed' }).eq('id', pollId)
    setConfirmAction(null)
    if (currentUserId) await loadData(currentUserId)
  }

  async function handleDeletePoll(pollId: string) {
    await supabase.from('polls').delete().eq('id', pollId)
    setConfirmAction(null)
    if (currentUserId) await loadData(currentUserId)
  }

  const displayedPolls = tab === 'active' ? activePolls : closedPolls

  if (loading || !group) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-stone-100 border-t-orange-400 animate-spin" />
          <p className="text-sm text-stone-400">Loading polls…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Navbar */}
      <nav className="w-full bg-white flex items-center justify-between px-8 py-4 shadow-sm sticky top-0 z-10">
        <Image src="/Asset 2.png" alt="Gather" width={96} height={32} className="w-24 object-contain" />
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/dashboard/${slug}`)}
            className="text-xs font-semibold text-stone-500 hover:text-stone-700 transition-colors px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200"
          >
            ← Dashboard
          </button>
          <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-full px-4 py-1.5 shadow-sm">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">
              {getInitials(group.name)}
            </div>
            <span className="text-sm font-medium text-stone-700 max-w-[140px] truncate">{group.name}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-5 py-5 space-y-4 pb-24">

        {/* Header banner */}
        <div className="relative rounded-2xl bg-gradient-to-br from-violet-500 via-pink-500 to-orange-400 p-5 min-h-[90px] flex items-end justify-between overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-white tracking-tight">Polls Hub</h1>
            <p className="text-sm text-white/80 mt-0.5">
              {activePolls.length} active · {closedPolls.length} closed
            </p>
          </div>
          <button
            onClick={() => router.push(`/groups/${slug}/create-poll`)}
            className="relative z-10 bg-white/20 border border-white/35 hover:bg-white/30 transition-colors text-white text-sm font-semibold rounded-xl px-4 py-2"
          >
            + New poll
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['active', 'closed'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200',
                tab === t
                  ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200',
              ].join(' ')}
            >
              {t === 'active' ? `Active (${activePolls.length})` : `Closed (${closedPolls.length})`}
            </button>
          ))}
        </div>

        {/* Poll list */}
        {displayedPolls.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <p className="text-2xl mb-3">{tab === 'active' ? '📊' : '📋'}</p>
            <p className="text-sm font-semibold text-stone-900">
              {tab === 'active' ? 'No active polls yet.' : 'No closed polls yet.'}
            </p>
            {tab === 'active' && (
              <button
                onClick={() => router.push(`/groups/${slug}/create-poll`)}
                className="mt-4 px-5 py-2 rounded-full bg-gradient-to-r from-violet-500 to-pink-500 text-white text-sm font-semibold hover:-translate-y-0.5 transition-transform"
              >
                Create your first poll
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedPolls.map((poll) => {
              const isAvailability = poll.poll_type === 'availability'
              const optionsArray: PollOption[] = Array.isArray(poll.options) ? (poll.options as PollOption[]) : []
              const availOpts: AvailabilityOptions | null = !isAvailability ? null : (poll.options as AvailabilityOptions)
              const availDates: string[] = availOpts?.dates ?? []
              const availResponses: Record<string, string[]> = availOpts?.responses ?? {}
              const maxVotes = Math.max(...(optionsArray.length ? optionsArray.map((o) => o.votes?.length ?? 0) : [0]), 0)
              const hasVoted = currentUserId && (poll.voters ?? []).includes(currentUserId)
              const isClosed = poll.status === 'closed'
              const selected = selectedOptions[poll.id]
              const myAvailDates = availabilitySelections[poll.id] ?? []
              const isSubmitting = votingPollId === poll.id

              return (
                <div key={poll.id} className={['bg-white border rounded-2xl overflow-hidden flex flex-col transition-all duration-200', isClosed ? 'border-stone-200 opacity-80' : 'border-stone-200 hover:border-violet-200 hover:shadow-sm'].join(' ')}>

                  {/* Top accent bar */}
                  <div className={`h-[3px] ${isClosed ? 'bg-stone-200' : 'bg-gradient-to-r from-violet-500 to-pink-500'}`} />

                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${poll.poll_type === 'availability' ? 'bg-gradient-to-r from-orange-50 to-pink-50 text-orange-700 border border-orange-200' : 'bg-gradient-to-r from-pink-50 to-violet-50 text-violet-700 border border-violet-200'}`}>
                        {poll.poll_type}
                      </span>
                      {isClosed && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">Closed</span>
                      )}
                      {poll.allow_multiple_votes && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">Multi-pick</span>
                      )}
                      {poll.is_anonymous && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">Anonymous</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                      {poll.expiry_date && !isClosed && (
                        <span className="text-[10px] text-stone-400">
                          Closes {new Date(poll.expiry_date).toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      <span className="text-xs text-stone-400">{poll.voters?.length ?? 0}/{group.members.length} voted</span>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-stone-900 px-4 pb-1 leading-snug">{poll.title}</p>
                  {poll.description && (
                    <p className="text-xs text-stone-400 px-4 pb-3 leading-snug">{poll.description}</p>
                  )}

                  {/* Activity poll: option cards */}
                  {!isAvailability && (
                    <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                      {optionsArray.map((opt) => {
                        const count = opt.votes?.length ?? 0
                        const pct = maxVotes > 0 ? Math.round((count / maxVotes) * 100) : 0
                        const isSelected = selected === opt.label
                        const isWinner = (hasVoted || isClosed) && maxVotes > 0 && count === maxVotes
                        return (
                          <button
                            key={opt.label}
                            onClick={() => !hasVoted && !isClosed && setSelectedOptions((prev) => ({ ...prev, [poll.id]: opt.label }))}
                            disabled={!!hasVoted || isClosed}
                            className={`w-full text-left rounded-xl border-2 overflow-hidden transition-all flex flex-col ${
                              isSelected ? 'border-violet-500 bg-violet-50' :
                              isWinner ? 'border-orange-300 bg-orange-50' :
                              'border-stone-100 bg-stone-50'
                            } ${!hasVoted && !isClosed ? 'hover:border-stone-300 cursor-pointer' : 'cursor-default'}`}
                          >
                            {opt.preview?.image && (
                              <img src={opt.preview.image} alt="" className="w-full h-24 object-cover" />
                            )}
                            <div className="p-2.5 flex-1 flex flex-col gap-1">
                              <p className="text-xs font-semibold text-stone-900 leading-snug line-clamp-2">
                                {opt.preview?.title || opt.label}
                              </p>
                              {opt.description && (
                                <p className="text-[10px] text-stone-500 leading-snug line-clamp-2">{opt.description}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-auto pt-1 flex-wrap">
                                {opt.cost && (
                                  <span className="text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">{opt.cost}</span>
                                )}
                                {opt.preview?.domain && (
                                  <span className="text-[10px] text-stone-400">{opt.preview.domain}</span>
                                )}
                                {(hasVoted || isClosed) && (
                                  <span className="text-[10px] font-bold text-stone-400 ml-auto">{count} vote{count !== 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                            {(hasVoted || isClosed) && pct > 0 && (
                              <div className="h-1 bg-stone-100">
                                <div className={`h-full bg-gradient-to-r ${isWinner ? 'from-violet-500 to-pink-500' : 'from-stone-200 to-stone-200'}`} style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Availability poll: date chips */}
                  {isAvailability && (
                    <div className="px-3 pb-3">
                      {availDates.length === 0 ? (
                        <p className="text-xs text-stone-400 text-center py-2">No dates set for this poll.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {availDates.map((dateStr) => {
                            const [y, mo, d] = dateStr.split('-').map(Number)
                            const label = new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                            const voteCount = Object.values(availResponses).filter((dates) => dates.includes(dateStr)).length
                            const isDateSelected = myAvailDates.includes(dateStr)
                            return (
                              <button
                                key={dateStr}
                                onClick={() => !hasVoted && !isClosed && toggleAvailabilityDate(poll.id, dateStr)}
                                disabled={!!hasVoted || isClosed}
                                className="px-3 py-1.5 rounded-full border-2 text-xs font-semibold transition-all"
                                style={isDateSelected
                                  ? { borderColor: '#7c3aed', background: '#faf9ff', color: '#7c3aed' }
                                  : hasVoted || isClosed
                                  ? { borderColor: '#e7e5e4', background: '#fafaf9', color: '#78716c' }
                                  : { borderColor: '#e7e5e4', background: 'white', color: '#78716c' }}
                              >
                                {label}
                                {(hasVoted || isClosed) && (
                                  <span className="ml-1.5 font-bold" style={{ color: voteCount > 0 ? '#22c55e' : '#a8a29e' }}>
                                    {voteCount}/{group.members.length}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-3 pb-3 space-y-2">
                    {isClosed ? (
                      <div className="text-center text-[11px] text-stone-400 py-1">
                        This poll is closed · {poll.voters?.length ?? 0} response{(poll.voters?.length ?? 0) !== 1 ? 's' : ''}
                      </div>
                    ) : isAvailability ? (
                      !hasVoted ? (
                        <button
                          onClick={() => handleAvailabilityVote(poll.id, myAvailDates)}
                          disabled={myAvailDates.length === 0 || isSubmitting}
                          className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-pink-500 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? 'Submitting…' : myAvailDates.length > 0 ? `Submit availability (${myAvailDates.length} date${myAvailDates.length !== 1 ? 's' : ''}) →` : 'Pick your available dates'}
                        </button>
                      ) : (
                        <div className="text-center text-[11px] text-stone-400">
                          Responded ✓ · {group.members.length - (poll.voters?.length ?? 0)} still pending
                        </div>
                      )
                    ) : !hasVoted ? (
                      <button
                        onClick={() => selected && handleVote(poll.id, selected)}
                        disabled={!selected || isSubmitting}
                        className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-500 to-pink-500 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Submitting…' : selected ? 'Confirm vote →' : 'Pick an option'}
                      </button>
                    ) : (
                      <div className="text-center text-[11px] text-stone-400">
                        Voted ✓ · {group.members.length - (poll.voters?.length ?? 0)} still pending
                      </div>
                    )}

                    {/* Creator controls */}
                    {!isClosed && poll.created_by === currentUserId && (
                      confirmAction?.pollId === poll.id ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                          <p className="text-xs font-semibold text-red-700 mb-2 text-center">
                            {confirmAction.type === 'delete' ? 'Delete this poll? This cannot be undone.' : 'Close this poll? Voting will end immediately.'}
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmAction(null)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => confirmAction.type === 'delete' ? handleDeletePoll(poll.id) : handleClosePoll(poll.id)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                            >
                              {confirmAction.type === 'delete' ? 'Yes, delete' : 'Yes, close'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmAction({ pollId: poll.id, type: 'close' })}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-stone-500 bg-stone-100 hover:bg-stone-200 transition-colors"
                          >
                            Close poll
                          </button>
                          <button
                            onClick={() => setConfirmAction({ pollId: poll.id, type: 'delete' })}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            Delete poll
                          </button>
                        </div>
                      )
                    )}

                    {/* Creator can still delete closed polls */}
                    {isClosed && poll.created_by === currentUserId && (
                      confirmAction?.pollId === poll.id && confirmAction.type === 'delete' ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                          <p className="text-xs font-semibold text-red-700 mb-2 text-center">Delete this poll? This cannot be undone.</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setConfirmAction(null)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeletePoll(poll.id)}
                              className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                            >
                              Yes, delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmAction({ pollId: poll.id, type: 'delete' })}
                          className="w-full py-1.5 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          Delete poll
                        </button>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 flex justify-around items-center py-2 z-10">
        {[
          { icon: '🏠', label: 'Home',     active: false, path: `/dashboard/${slug}` },
          { icon: '📅', label: 'Calendar', active: false, path: `/groups/${slug}/calendar-view` },
          { icon: '📊', label: 'Polls',    active: true,  path: null },
          { icon: '🎯', label: 'Events',   active: false, path: `/groups/${slug}/events-hub` },
          { icon: '👤', label: 'Profile',  active: false, path: null },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => item.path && router.push(item.path)}
            className="flex flex-col items-center gap-0.5 px-4 py-1"
          >
            <span className="text-lg">{item.icon}</span>
            <span className={`text-[10px] font-medium ${item.active ? 'text-violet-600 font-bold' : 'text-stone-400'}`}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
