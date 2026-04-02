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

const ACCESSIBILITY_FLAGS: Record<string, { label: string; emoji: string }> = {
  step_free:          { label: 'Step-free access',   emoji: '♿' },
  elevator:           { label: 'Elevator on site',   emoji: '🛗' },
  limited_walking:    { label: 'Limited walking',    emoji: '🚶' },
  seating_available:  { label: 'Seating available',  emoji: '🪑' },
  accessible_parking: { label: 'Accessible parking', emoji: '🅿️' },
  loud_environment:   { label: 'Loud / busy space',  emoji: '🔊' },
}

function formatFlag(key: string) {
  const f = ACCESSIBILITY_FLAGS[key]
  return f ? `${f.emoji} ${f.label}` : key.replace(/_/g, ' ')
}

const PIP_GRADIENTS = [
  'from-orange-400 to-pink-500',
  'from-pink-500 to-violet-600',
  'from-orange-400 to-yellow-400',
  'from-violet-500 to-indigo-500',
]

function formatFullDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr)
  return { day: d.getDate(), month: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear() }
}

function getTimeDisplay(dateStr: string): string | null {
  if (dateStr.includes('T00:00:00')) return null
  const d = new Date(dateStr)
  return d.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' })
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function isPast(dateStr: string) {
  return new Date(dateStr) < new Date()
}

export default function EventsHubPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const { slug } = params

  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [pastEvents, setPastEvents] = useState<Event[]>([])
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
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

    const now = new Date().toISOString()

    const [membersRes, upcomingRes, pastRes] = await Promise.all([
      supabase.from('users').select('id, display_name').in('id', groupData.members),
      supabase.from('events').select('*').eq('group_id', groupData.id).gte('date', now).order('date', { ascending: true }),
      supabase.from('events').select('*').eq('group_id', groupData.id).lt('date', now).order('date', { ascending: false }),
    ])

    setMembers(membersRes.data ?? [])
    setUpcomingEvents(upcomingRes.data ?? [])
    setPastEvents(pastRes.data ?? [])
    setLoading(false)
  }

  function getMemberName(userId: string) {
    return members.find((m) => m.id === userId)?.display_name ?? 'Member'
  }

  const displayedEvents = tab === 'upcoming' ? upcomingEvents : pastEvents

  if (loading || !group) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-stone-100 border-t-orange-400 animate-spin" />
          <p className="text-sm text-stone-400">Loading events…</p>
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
        <div className="relative rounded-2xl bg-gradient-to-br from-orange-400 via-pink-500 to-violet-700 p-5 min-h-[90px] flex items-end justify-between overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-white tracking-tight">Events Hub</h1>
            <p className="text-sm text-white/80 mt-0.5">
              {upcomingEvents.length} upcoming · {pastEvents.length} past
            </p>
          </div>
          <button
            onClick={() => router.push(`/groups/${slug}/create-event`)}
            className="relative z-10 bg-white/20 border border-white/35 hover:bg-white/30 transition-colors text-white text-sm font-semibold rounded-xl px-4 py-2"
          >
            + New event
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['upcoming', 'past'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200',
                tab === t
                  ? 'bg-gradient-to-r from-orange-400 to-pink-500 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200',
              ].join(' ')}
            >
              {t === 'upcoming' ? `Upcoming (${upcomingEvents.length})` : `Past (${pastEvents.length})`}
            </button>
          ))}
        </div>

        {/* Event list */}
        {displayedEvents.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
            <p className="text-2xl mb-3">{tab === 'upcoming' ? '📅' : '📖'}</p>
            <p className="text-sm font-semibold text-stone-900">
              {tab === 'upcoming' ? 'No upcoming events yet.' : 'No past events yet.'}
            </p>
            {tab === 'upcoming' && (
              <button
                onClick={() => router.push(`/groups/${slug}/create-event`)}
                className="mt-4 px-5 py-2 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 text-white text-sm font-semibold hover:-translate-y-0.5 transition-transform"
              >
                Create your first event
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedEvents.map((event) => {
              const { day, month, year } = formatShortDate(event.date)
              const startTime = getTimeDisplay(event.date)
              const endTime = event.end_date ? getTimeDisplay(event.end_date) : null
              const taskCount = event.tasks ? event.tasks.filter((t) => t.label).length : 0
              const completedTasks = event.tasks ? event.tasks.filter((t) => t.label && t.assigned_to).length : 0
              const visibleAttendees = (event.attendees ?? []).slice(0, 5)
              const extraAttendees = Math.max(0, (event.attendees ?? []).length - 5)
              const isExpanded = expandedId === event.id
              const isConfirmed = event.status === 'confirmed'
              const isPastEvent = isPast(event.date)

              return (
                <div
                  key={event.id}
                  className={[
                    'bg-white border rounded-2xl overflow-hidden transition-all duration-200',
                    isPastEvent ? 'border-stone-200 opacity-80' : 'border-stone-200 hover:border-orange-200 hover:shadow-sm',
                  ].join(' ')}
                >
                  {/* Top accent bar */}
                  <div className={`h-[3px] ${isConfirmed ? 'bg-gradient-to-r from-orange-400 to-pink-500' : 'bg-stone-200'}`} />

                  {/* Main card row */}
                  <div
                    className="flex items-stretch gap-0 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  >
                    {/* Date block */}
                    <div className={[
                      'flex flex-col items-center justify-center px-5 py-4 min-w-[72px] flex-shrink-0 border-r',
                      isConfirmed ? 'bg-gradient-to-b from-orange-50 to-pink-50 border-orange-100' : 'bg-stone-50 border-stone-100',
                    ].join(' ')}>
                      <span className={`text-2xl font-bold leading-none ${isConfirmed ? 'text-orange-600' : 'text-stone-400'}`}>{day}</span>
                      <span className={`text-[10px] uppercase tracking-wider mt-0.5 font-semibold ${isConfirmed ? 'text-pink-500' : 'text-stone-400'}`}>{month}</span>
                      <span className="text-[10px] text-stone-300 mt-0.5">{year}</span>
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-stone-900 truncate">{event.title}</h3>
                            {isConfirmed ? (
                              <span className="text-[10px] font-bold bg-gradient-to-r from-orange-50 to-pink-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                Confirmed
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium bg-stone-100 text-stone-500 border border-stone-200 px-2 py-0.5 rounded-full flex-shrink-0">
                                Proposed
                              </span>
                            )}
                            {isPastEvent && (
                              <span className="text-[10px] font-medium bg-violet-50 text-violet-500 border border-violet-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                Past
                              </span>
                            )}
                          </div>

                          {/* Time */}
                          {startTime && (
                            <p className="text-xs text-stone-500 mt-0.5">
                              🕐 {startTime}{endTime ? ` – ${endTime}` : ''}
                            </p>
                          )}

                          {/* Location */}
                          {event.location && (
                            <p className="text-xs text-stone-500 mt-0.5 truncate">
                              📍{' '}
                              {event.location_url ? (
                                <a
                                  href={event.location_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline hover:text-orange-600 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {event.location}
                                </a>
                              ) : event.location}
                            </p>
                          )}
                        </div>

                        {/* Right side: attendees + expand chevron */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {visibleAttendees.length > 0 && (
                            <div className="flex -space-x-1.5">
                              {visibleAttendees.map((uid, idx) => (
                                <div
                                  key={uid}
                                  title={getMemberName(uid)}
                                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${PIP_GRADIENTS[idx % PIP_GRADIENTS.length]} flex items-center justify-center text-white text-[9px] font-bold border-2 border-white`}
                                >
                                  {getInitials(getMemberName(uid))}
                                </div>
                              ))}
                              {extraAttendees > 0 && (
                                <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 text-[9px] font-semibold border-2 border-white">
                                  +{extraAttendees}
                                </div>
                              )}
                            </div>
                          )}
                          <span className={`text-stone-400 text-sm transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                            ▾
                          </span>
                        </div>
                      </div>

                      {/* Pills row */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {event.cost_per_person && (
                          <span className="text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                            💰 {event.cost_per_person}
                          </span>
                        )}
                        {event.host_name && (
                          <span className="text-[10px] text-stone-500 bg-stone-50 border border-stone-200 px-2 py-0.5 rounded-full">
                            👤 {event.host_name}
                          </span>
                        )}
                        {taskCount > 0 && (
                          <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full">
                            ✓ {completedTasks}/{taskCount} tasks
                          </span>
                        )}
                        {event.link_domain && (
                          <span className="text-[10px] text-stone-400 bg-stone-50 border border-stone-100 px-2 py-0.5 rounded-full">
                            🔗 {event.link_domain}
                          </span>
                        )}
                        {(event.accessibility_flags ?? []).map((flag) => (
                          <span key={flag} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                            {formatFlag(flag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-stone-100 px-4 py-4 bg-stone-50/50 space-y-4">

                      {/* Full date */}
                      <div className="flex gap-6 flex-wrap text-xs text-stone-600">
                        <div>
                          <span className="font-semibold text-stone-400 uppercase tracking-wide text-[10px] block mb-0.5">Date</span>
                          {formatFullDate(event.date)}
                          {event.end_date && formatFullDate(event.end_date) !== formatFullDate(event.date) && ` → ${formatFullDate(event.end_date)}`}
                        </div>
                        {startTime && (
                          <div>
                            <span className="font-semibold text-stone-400 uppercase tracking-wide text-[10px] block mb-0.5">Time</span>
                            {startTime}{endTime ? ` – ${endTime}` : ''}
                          </div>
                        )}
                        {event.cost_per_person && (
                          <div>
                            <span className="font-semibold text-stone-400 uppercase tracking-wide text-[10px] block mb-0.5">Cost</span>
                            {event.cost_per_person}
                          </div>
                        )}
                      </div>

                      {/* Host info */}
                      {(event.host_name || event.host_phone) && (
                        <div>
                          <span className="font-semibold text-stone-400 uppercase tracking-wide text-[10px] block mb-1">Host</span>
                          <div className="flex items-center gap-3 text-xs text-stone-700">
                            {event.host_name && <span className="font-medium">{event.host_name}</span>}
                            {event.host_phone && (
                              <a href={`tel:${event.host_phone}`} className="text-orange-600 hover:underline">
                                {event.host_phone}
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Link preview */}
                      {event.activity_url && event.activity_url.trim() !== '' && (
                        <div>
                          <span className="font-semibold text-stone-400 uppercase tracking-wide text-[10px] block mb-1">Activity link</span>
                          <a
                            href={event.activity_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl p-3 hover:border-orange-200 transition-colors group"
                          >
                            {event.link_image && (
                              <img
                                src={event.link_image}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              {event.link_title ? (
                                <p className="text-sm font-semibold text-stone-900 truncate group-hover:text-orange-600 transition-colors">{event.link_title}</p>
                              ) : (
                                <p className="text-sm font-medium text-blue-600 truncate group-hover:text-orange-600 transition-colors">{event.activity_url}</p>
                              )}
                              {event.link_domain && (
                                <p className="text-xs text-stone-500 mt-0.5">{event.link_domain}</p>
                              )}
                            </div>
                            <span className="text-stone-300 text-sm flex-shrink-0">↗</span>
                          </a>
                        </div>
                      )}

                      {/* Things to know */}
                      {event.things_to_know && (
                        <div>
                          <span className="font-semibold text-stone-400 uppercase tracking-wide text-[10px] block mb-1">Things to know</span>
                          <p className="text-xs text-stone-700 leading-relaxed bg-white border border-stone-200 rounded-xl px-3 py-2.5">
                            {event.things_to_know}
                          </p>
                        </div>
                      )}

                      {/* Accessibility */}
                      {(event.accessibility_flags ?? []).length > 0 && (
                        <div>
                          <span className="font-semibold text-stone-400 uppercase tracking-wide text-[10px] block mb-1">Accessibility</span>
                          <div className="flex flex-wrap gap-1.5">
                            {(event.accessibility_flags ?? []).map((flag) => (
                              <span key={flag} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                                {formatFlag(flag)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tasks */}
                      {event.tasks && event.tasks.filter((t) => t.label).length > 0 && (
                        <div>
                          <span className="font-semibold text-stone-400 uppercase tracking-wide text-[10px] block mb-1">Tasks</span>
                          <div className="space-y-1.5">
                            {event.tasks.filter((t) => t.label).map((task) => (
                              <div key={task.id} className="flex items-center gap-2.5 bg-white border border-stone-200 rounded-xl px-3 py-2">
                                <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] ${task.assigned_to ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white' : 'bg-stone-100 border border-stone-200'}`}>
                                  {task.assigned_to ? '✓' : ''}
                                </div>
                                <span className="text-xs text-stone-700 flex-1">{task.label}</span>
                                {task.assigned_to && (
                                  <span className="text-[10px] text-stone-400">{getMemberName(task.assigned_to)}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Attendees */}
                      {(event.attendees ?? []).length > 0 && (
                        <div>
                          <span className="font-semibold text-stone-400 uppercase tracking-wide text-[10px] block mb-1">
                            Attendees ({event.attendees.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {event.attendees.map((uid, idx) => (
                              <div
                                key={uid}
                                className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-full pl-1 pr-2.5 py-1"
                              >
                                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${PIP_GRADIENTS[idx % PIP_GRADIENTS.length]} flex items-center justify-center text-white text-[8px] font-bold`}>
                                  {getInitials(getMemberName(uid))}
                                </div>
                                <span className="text-xs text-stone-700">{getMemberName(uid)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
          { icon: '📊', label: 'Polls',    active: false, path: `/groups/${slug}/poll-hub` },
          { icon: '🎯', label: 'Events',   active: true,  path: null },
          { icon: '👤', label: 'Profile',  active: false, path: null },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => item.path && router.push(item.path)}
            className="flex flex-col items-center gap-0.5 px-4 py-1"
          >
            <span className="text-lg">{item.icon}</span>
            <span className={`text-[10px] font-medium ${item.active ? 'text-orange-600 font-bold' : 'text-stone-400'}`}>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
