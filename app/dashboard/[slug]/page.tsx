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
  created_date: string
}

interface GroupMember {
  id: string
  display_name: string
}

interface Event {
  id: string
  title: string
  date: string
  end_date: string | null
  location: string | null
  location_url: string | null
  status: string
  attendees: string[]
  cost_per_person: string | null
  host_name: string | null
  host_phone: string | null
  activity_url: string | null
  link_title: string | null
  link_image: string | null
  link_domain: string | null
  things_to_know: string | null
  accessibility_flags: string[] | null
  tasks: Array<{ id: string; label: string; assigned_to: string | null }> | null
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

interface Poll {
  id: string
  title: string
  description: string | null
  poll_type: string
  options: PollOption[]
  voters: string[]
  closes_on: string | null
  allow_multiple: boolean
  is_anonymous: boolean
}

const PIP_GRADIENTS = [
  'from-orange-400 to-pink-500',
  'from-pink-500 to-violet-600',
  'from-orange-400 to-yellow-400',
  'from-violet-500 to-indigo-500',
]

const DOT_COLORS: Record<string, string> = {
  green: 'bg-green-400',
  orange: 'bg-orange-400',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return { day: d.getDate(), month: d.toLocaleString('default', { month: 'short' }) }
}

function getTimeDisplay(dateStr: string): string | null {
  // If stored as UTC midnight, no time was set
  if (dateStr.includes('T00:00:00')) return null
  const d = new Date(dateStr)
  return d.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' })
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function buildCalendarGrid(year: number, month: number, events: Event[]) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const today = new Date()

  const confirmedDates = new Set(events.filter((e) => e.status === 'confirmed').map((e) => new Date(e.date).getDate()))
  const proposedDates = new Set(events.filter((e) => e.status === 'proposed').map((e) => new Date(e.date).getDate()))

  const cells = []
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, thisMonth: false, dots: [], isToday: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dots: string[] = []
    if (confirmedDates.has(d)) dots.push('green')
    if (proposedDates.has(d)) dots.push('orange')
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
    cells.push({ day: d, thisMonth: true, dots, isToday })
  }
  let next = 1
  while (cells.length < 35) {
    cells.push({ day: next++, thisMonth: false, dots: [], isToday: false })
  }
  return cells
}

export default function DashboardPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const { slug } = params

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [polls, setPolls] = useState<Poll[]>([])

  const now = new Date()
  const calendarGrid = buildCalendarGrid(now.getFullYear(), now.getMonth(), events)
  const calMonthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }
      setCurrentUserId(session.user.id)
      loadGroupData(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadGroupData(userId: string) {
    setLoading(true)

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('url_slug', slug)
      .single()

    if (groupError || !groupData) { router.push('/'); return }
    if (!groupData.members.includes(userId)) { router.push('/'); return }

    setGroup(groupData)

    const [membersRes, eventsRes, pollsRes] = await Promise.all([
      supabase.from('users').select('id, display_name').in('id', groupData.members),
      supabase.from('events').select('*').eq('group_id', groupData.id).gte('date', new Date().toISOString()).order('date', { ascending: true }).limit(5),
      supabase.from('polls').select('*').eq('group_id', groupData.id).eq('status', 'active').order('created_date', { ascending: false }).limit(4),
    ])

    setMembers(membersRes.data ?? [])
    setEvents(eventsRes.data ?? [])
    setPolls(pollsRes.data ?? [])
    setLoading(false)
  }

  const activePolls = polls.length
  const upcomingEvents = events.length
  const pendingVotes = polls.filter((p) => currentUserId && !(p.voters ?? []).includes(currentUserId)).length

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [votingPollId, setVotingPollId] = useState<string | null>(null)

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
      await loadGroupData(currentUserId)
    }
    setVotingPollId(null)
    setSelectedOptions((prev: Record<string, string>) => { const n = { ...prev }; delete n[pollId]; return n })
  }

  function getMemberName(userId: string) {
    return members.find((m) => m.id === userId)?.display_name ?? 'Member'
  }

  function goToCreatePoll() {
    router.push(`/groups/${slug}/create-poll`)
  }

  function goToCreateEvent() {
    router.push(`/groups/${slug}/create-event`)
  }

  if (loading || !group) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-stone-100 border-t-orange-400 animate-spin" />
          <p className="text-sm text-stone-400">Loading your group...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Navbar */}
      <nav className="w-full bg-white flex items-center justify-between px-8 py-4 shadow-sm sticky top-0 z-10">
        <Image src="/Asset 1.png" alt="Gather" width={96} height={32} className="w-24 object-contain" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-full px-4 py-1.5 shadow-sm">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-[10px] font-bold">
              {getInitials(group.name)}
            </div>
            <span className="text-sm font-medium text-stone-700 max-w-[140px] truncate">{group.name}</span>
          </div>
          <button className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-base hover:bg-stone-200 transition-colors">🔔</button>
          <button className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-base hover:bg-stone-200 transition-colors">👤</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-5 py-5 space-y-4">

        {/* Group banner */}
        <div className="relative rounded-2xl bg-gradient-to-br from-orange-400 via-pink-500 to-violet-700 p-5 min-h-[100px] flex items-end justify-between overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-white tracking-tight">{group.name}</h1>
            <p className="text-sm text-white/80 mt-0.5">
              {group.members.length} member{group.members.length !== 1 ? 's' : ''}
              {group.description ? ` · ${group.description}` : ''}
            </p>
          </div>
          <div className="relative z-10 text-center">
            <p className="text-[10px] text-white/70 uppercase tracking-widest mb-1">invite code</p>
            <div className="bg-white/20 border border-white/35 rounded-xl px-3 py-1.5">
              <span className="text-lg font-bold text-white tracking-[4px]">{group.code}</span>
            </div>
          </div>
        </div>

        {/* Health score */}
        <div className="rounded-xl bg-gradient-to-r from-orange-50 via-pink-50 to-violet-50 border border-stone-200 p-4 flex items-center gap-4">
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg viewBox="0 0 52 52" className="w-14 h-14">
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
              <circle cx="26" cy="26" r="20" fill="none" stroke="#ede9fe" strokeWidth="4" />
              <circle cx="26" cy="26" r="20" fill="none" stroke="url(#ringGrad)" strokeWidth="4"
                strokeDasharray="113"
                strokeDashoffset={113 - (113 * Math.min(upcomingEvents * 10 + activePolls * 15, 100)) / 100}
                strokeLinecap="round" transform="rotate(-90 26 26)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-orange-500">
              {Math.min(upcomingEvents * 10 + activePolls * 15, 100)}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-stone-900">Group health score</p>
            <p className="text-xs text-stone-400 mt-0.5">
              {activePolls} active poll{activePolls !== 1 ? 's' : ''} · {upcomingEvents} upcoming event{upcomingEvents !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="bg-gradient-to-r from-orange-400 to-pink-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap">
            👥 {group.members.length} member{group.members.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active polls',    value: activePolls,    accent: 'from-orange-400 to-pink-500' },
            { label: 'Upcoming events', value: upcomingEvents, accent: 'from-pink-500 to-violet-600' },
            { label: 'Pending votes',   value: pendingVotes,   accent: 'from-violet-600 to-indigo-500' },
          ].map((s) => (
            <div key={s.label} className="relative bg-white border border-stone-200 rounded-xl pt-4 pb-3 px-4 overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${s.accent}`} />
              <p className="text-xs text-stone-400 mb-1">{s.label}</p>
              <p className="text-3xl font-bold text-stone-900 leading-none">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Calendar + Events */}
        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-stone-100">
              <span className="text-sm font-semibold text-stone-900">Calendar</span>
              <span className="text-xs font-semibold text-orange-600 cursor-pointer">Full view</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <button className="w-7 h-7 rounded-full bg-stone-50 border border-stone-200 flex items-center justify-center text-xs text-stone-600 hover:bg-stone-100 transition-colors">‹</button>
                <span className="text-sm font-semibold text-stone-900">{calMonthLabel}</span>
                <button className="w-7 h-7 rounded-full bg-stone-50 border border-stone-200 flex items-center justify-center text-xs text-stone-600 hover:bg-stone-100 transition-colors">›</button>
              </div>
              <div className="grid grid-cols-7 text-center mb-1">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                  <div key={d} className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide pb-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 text-center">
                {calendarGrid.map((cell, i) => (
                  <div key={i} className={[
                    'text-xs py-1 rounded-lg cursor-pointer transition-colors',
                    !cell.thisMonth ? 'text-stone-200' : 'text-stone-900 hover:bg-stone-50',
                    cell.isToday ? '!bg-gradient-to-br !from-orange-400 !to-pink-500 !text-white font-bold' : '',
                  ].join(' ')}>
                    {cell.day}
                    {cell.dots.length > 0 && (
                      <div className="flex justify-center gap-0.5 mt-0.5">
                        {cell.dots.map((dot, j) => (
                          <div key={j} className={`w-1 h-1 rounded-full ${DOT_COLORS[dot]}`} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-3 pt-3 border-t border-stone-100">
                {[{ color: 'bg-green-400', label: 'Events' }, { color: 'bg-orange-400', label: 'Proposed' }].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${l.color}`} />
                    <span className="text-[11px] text-stone-400">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-stone-100">
              <span className="text-sm font-semibold text-stone-900">Upcoming events</span>
              <button onClick={goToCreateEvent} className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors">+ New event</button>
            </div>
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-stone-400">No upcoming events yet.</p>
                <p className="text-xs text-stone-300 mt-1">Create one to get started!</p>
              </div>
            ) : events.map((e) => {
              const { day, month } = formatDate(e.date)
              const startTime = getTimeDisplay(e.date)
              const endTime = e.end_date ? getTimeDisplay(e.end_date) : null
              const taskCount = e.tasks ? e.tasks.filter((t: { label: string }) => t.label).length : 0
              const attendees = (e.attendees ?? []).slice(0, 3)
              const extraCount = Math.max(0, (e.attendees ?? []).length - 3)
              return (
                <div key={e.id} className="flex items-start gap-3 px-4 py-3 border-b border-stone-100 last:border-none hover:bg-stone-50 transition-colors cursor-pointer">
                  <div className={`min-w-[40px] text-center rounded-xl py-1.5 px-1 flex-shrink-0 ${e.status === 'confirmed' ? 'bg-gradient-to-b from-orange-50 to-pink-50 border border-orange-200' : 'bg-stone-50 border border-stone-200'}`}>
                    <div className={`text-lg font-bold leading-none ${e.status === 'confirmed' ? 'text-orange-600' : 'text-stone-400'}`}>{day}</div>
                    <div className={`text-[9px] uppercase tracking-wide mt-0.5 ${e.status === 'confirmed' ? 'text-pink-500' : 'text-stone-400'}`}>{month}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-stone-900 truncate">{e.title}</p>
                      {e.status === 'proposed' && (
                        <span className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Proposed</span>
                      )}
                    </div>
                    {startTime && (
                      <p className="text-xs text-stone-500 mt-0.5">{startTime}{endTime ? ` – ${endTime}` : ''}</p>
                    )}
                    {e.location && (
                      <p className="text-xs text-stone-400 mt-0.5 truncate">
                        {e.location_url ? (
                          <a href={e.location_url} target="_blank" rel="noreferrer" className="underline hover:text-orange-600 transition-colors" onClick={ev => ev.stopPropagation()}>
                            {e.location}
                          </a>
                        ) : e.location}
                      </p>
                    )}
                    {(e.cost_per_person || e.host_name || taskCount > 0) && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {e.cost_per_person && (
                          <span className="text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">{e.cost_per_person}</span>
                        )}
                        {e.host_name && (
                          <span className="text-[10px] text-stone-400">Host: {e.host_name}</span>
                        )}
                        {taskCount > 0 && (
                          <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    )}
                    {e.link_domain && (
                      <p className="text-[10px] text-stone-400 mt-0.5">🔗 {e.link_domain}</p>
                    )}
                    {attendees.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {attendees.map((uid, idx) => (
                          <div key={uid} title={getMemberName(uid)} className={`w-6 h-6 rounded-full bg-gradient-to-br ${PIP_GRADIENTS[idx % PIP_GRADIENTS.length]} flex items-center justify-center text-white text-[9px] font-bold border-2 border-white`}>
                            {getInitials(getMemberName(uid))}
                          </div>
                        ))}
                        {extraCount > 0 && (
                          <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-[9px] font-semibold border-2 border-white">+{extraCount}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Active polls */}
        {polls.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-stone-900">Active polls</h2>
              <button
                onClick={goToCreatePoll}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
              >
                + Create poll
              </button>
            </div>
            <div className="space-y-3">
              {polls.map((poll) => {
                const maxVotes = Math.max(...(poll.options?.map((o) => o.votes?.length ?? 0) ?? [0]), 0)
                const hasVoted = currentUserId && (poll.voters ?? []).includes(currentUserId)
                const selected = selectedOptions[poll.id]
                const isSubmitting = votingPollId === poll.id
                return (
                  <div key={poll.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${poll.poll_type === 'availability' ? 'bg-gradient-to-r from-orange-50 to-pink-50 text-orange-700 border border-orange-200' : 'bg-gradient-to-r from-pink-50 to-violet-50 text-violet-700 border border-violet-200'}`}>
                          {poll.poll_type}
                        </span>
                        {poll.allow_multiple && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">Multi-pick</span>
                        )}
                        {poll.is_anonymous && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">Anonymous</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                        {poll.closes_on && (
                          <span className="text-[10px] text-stone-400">
                            Closes {new Date(poll.closes_on).toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        <span className="text-xs text-stone-400">{poll.voters?.length ?? 0}/{group.members.length} voted</span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-stone-900 px-4 pb-1 leading-snug">{poll.title}</p>
                    {poll.description && (
                      <p className="text-xs text-stone-400 px-4 pb-3 leading-snug">{poll.description}</p>
                    )}

                    {/* Option cards */}
                    <div className="px-3 pb-3 grid grid-cols-2 gap-2">
                      {poll.options?.map((opt) => {
                        const count = opt.votes?.length ?? 0
                        const pct = maxVotes > 0 ? Math.round((count / maxVotes) * 100) : 0
                        const isSelected = selected === opt.label
                        const isWinner = hasVoted && maxVotes > 0 && count === maxVotes
                        return (
                          <button
                            key={opt.label}
                            onClick={() => !hasVoted && setSelectedOptions((prev: Record<string, string>) => ({ ...prev, [poll.id]: opt.label }))}
                            disabled={!!hasVoted}
                            className={`w-full text-left rounded-xl border-2 overflow-hidden transition-all flex flex-col ${
                              isSelected ? 'border-violet-500 bg-violet-50' :
                              isWinner ? 'border-orange-300 bg-orange-50' :
                              'border-stone-100 bg-stone-50'
                            } ${!hasVoted ? 'hover:border-stone-300 cursor-pointer' : 'cursor-default'}`}
                          >
                            {/* Image */}
                            {opt.preview?.image && (
                              <img src={opt.preview.image} alt="" className="w-full h-24 object-cover" />
                            )}

                            <div className="p-2.5 flex-1 flex flex-col gap-1">
                              {/* Title */}
                              <p className="text-xs font-semibold text-stone-900 leading-snug line-clamp-2">
                                {opt.preview?.title || opt.label}
                              </p>

                              {/* Description */}
                              {opt.description && (
                                <p className="text-[10px] text-stone-500 leading-snug line-clamp-2">{opt.description}</p>
                              )}

                              {/* Cost + domain row */}
                              <div className="flex items-center gap-1.5 mt-auto pt-1 flex-wrap">
                                {opt.cost && (
                                  <span className="text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">{opt.cost}</span>
                                )}
                                {opt.preview?.domain && (
                                  <span className="text-[10px] text-stone-400">{opt.preview.domain}</span>
                                )}
                                {hasVoted && (
                                  <span className="text-[10px] font-bold text-stone-400 ml-auto">{count} vote{count !== 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>

                            {hasVoted && pct > 0 && (
                              <div className="h-1 bg-stone-100">
                                <div className={`h-full bg-gradient-to-r ${isWinner ? 'from-orange-400 to-pink-500' : 'from-stone-200 to-stone-200'}`} style={{ width: `${pct}%` }} />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Footer */}
                    <div className="px-3 pb-3">
                      {!hasVoted ? (
                        <button
                          onClick={() => selected && handleVote(poll.id, selected)}
                          disabled={!selected || isSubmitting}
                          className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-400 to-pink-500 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? 'Submitting…' : selected ? 'Confirm vote →' : 'Pick an option'}
                        </button>
                      ) : (
                        <div className="text-center text-[11px] text-stone-400">
                          Voted ✓ · {group.members.length - (poll.voters?.length ?? 0)} still pending
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {polls.length === 0 && events.length === 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
            <p className="text-2xl mb-3">🎉</p>
            <p className="text-sm font-semibold text-stone-900">Your group is ready!</p>
            <p className="text-xs text-stone-400 mt-1">Create an event or poll to get started.</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3 pb-4">
          {[
            { label: '＋ Create event', action: () => {} },
            { label: '📊 Create poll',  action: goToCreatePoll },
            { label: '🔗 Share invite', action: () => {} },
          ].map(({ label, action }) => (
            <button key={label} onClick={action} className="relative overflow-hidden bg-stone-900 text-white py-3 rounded-2xl text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 group">
              <span className="absolute inset-0 bg-gradient-to-br from-orange-400 via-pink-500 to-violet-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 flex justify-around items-center py-2 z-10">
        {[
          { icon: '🏠', label: 'Home',     active: true },
          { icon: '📅', label: 'Calendar', active: false },
          { icon: '📊', label: 'Polls',    active: false },
          { icon: '🎯', label: 'Events',   active: false },
          { icon: '👤', label: 'Profile',  active: false },
        ].map((item) => (
          <button key={item.label} className="flex flex-col items-center gap-0.5 px-4 py-1">
            <span className="text-lg">{item.icon}</span>
            <span className={`text-[10px] font-medium ${item.active ? 'text-orange-600 font-bold' : 'text-stone-400'}`}>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="h-16" />
    </div>
  )
}