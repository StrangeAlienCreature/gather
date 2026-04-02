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
  url_slug: string
  members: string[]
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
}

type ViewMode = 'month' | 'week' | 'agenda'

const PIP_GRADIENTS = [
  'from-orange-400 to-pink-500',
  'from-pink-500 to-violet-600',
  'from-orange-400 to-yellow-400',
  'from-violet-500 to-indigo-500',
]

function EventPill({ event, compact = false, getMemberName, onNavigate }: EventPillProps) {
  const isConfirmed = event.status === 'confirmed'
  const time = getTimeDisplay(event.date)
  if (compact) {
    return (
      <div
        className={`text-[9px] font-semibold truncate rounded px-1 py-0.5 leading-tight cursor-pointer ${
          isConfirmed ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-500'
        }`}
        title={event.title}
        onClick={onNavigate}
      >
        {event.title}
      </div>
    )
  }
  return (
    <div
      className={`flex items-start gap-3 bg-white border rounded-2xl overflow-hidden cursor-pointer hover:shadow-sm transition-all ${
        isConfirmed ? 'border-orange-200 hover:border-orange-300' : 'border-stone-200 hover:border-stone-300'
      }`}
      onClick={onNavigate}
    >
      <div className={`h-full w-[3px] self-stretch flex-shrink-0 ${isConfirmed ? 'bg-gradient-to-b from-orange-400 to-pink-500' : 'bg-stone-200'}`} />
      <div className="flex-1 min-w-0 py-3 pr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-stone-900 truncate">{event.title}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
            isConfirmed ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-stone-100 text-stone-500 border border-stone-200'
          }`}>
            {isConfirmed ? 'Confirmed' : 'Proposed'}
          </span>
        </div>
        {time && <p className="text-xs text-stone-500 mt-0.5">🕐 {time}</p>}
        {event.location && (
          <p className="text-xs text-stone-400 mt-0.5 truncate">
            📍{' '}
            {event.location_url ? (
              <a href={event.location_url} target="_blank" rel="noreferrer"
                className="underline hover:text-orange-600" onClick={(e) => e.stopPropagation()}>
                {event.location}
              </a>
            ) : event.location}
          </p>
        )}
        {event.cost_per_person && (
          <p className="text-xs text-green-600 mt-0.5">💰 {event.cost_per_person}</p>
        )}
        {(event.attendees ?? []).length > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <div className="flex -space-x-1">
              {(event.attendees ?? []).slice(0, 4).map((uid, idx) => (
                <div
                  key={uid}
                  title={getMemberName(uid)}
                  className={`w-5 h-5 rounded-full bg-gradient-to-br ${PIP_GRADIENTS[idx % PIP_GRADIENTS.length]} flex items-center justify-center text-white text-[7px] font-bold border border-white`}
                >
                  {getInitials(getMemberName(uid))}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-stone-400">{event.attendees.length} going</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface EventPillProps {
  key?: string | number
  event: Event
  compact?: boolean
  getMemberName: (uid: string) => string
  onNavigate: () => void
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function getTimeDisplay(dateStr: string): string | null {
  if (dateStr.includes('T00:00:00')) return null
  const d = new Date(dateStr)
  return d.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' })
}

function startOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function eventsOnDay(events: Event[], day: Date) {
  return events.filter((e) => isSameDay(new Date(e.date), day))
}

function formatAgendaDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (isSameDay(d, today)) return 'Today'
  if (isSameDay(d, tomorrow)) return 'Tomorrow'
  return d.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function CalendarViewPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const { slug } = params

  const [loading, setLoading] = useState(true)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [view, setView] = useState<ViewMode>('month')

  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now))
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

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

    const [membersRes, eventsRes] = await Promise.all([
      supabase.from('users').select('id, display_name').in('id', groupData.members),
      supabase.from('events').select('*').eq('group_id', groupData.id).order('date', { ascending: true }),
    ])

    setMembers(membersRes.data ?? [])
    setEvents(eventsRes.data ?? [])
    setLoading(false)
  }

  function getMemberName(userId: string) {
    return members.find((m) => m.id === userId)?.display_name ?? 'Member'
  }

  // ── Month helpers ──────────────────────────────────────────────
  const calMonthLabel = new Date(calYear, calMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

  function buildMonthGrid() {
    const firstDay = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const daysInPrev = new Date(calYear, calMonth, 0).getDate()
    const cells: { date: Date; thisMonth: boolean }[] = []
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ date: new Date(calYear, calMonth - 1, daysInPrev - i), thisMonth: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(calYear, calMonth, d), thisMonth: true })
    }
    let next = 1
    while (cells.length % 7 !== 0) {
      cells.push({ date: new Date(calYear, calMonth + 1, next++), thisMonth: false })
    }
    return cells
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11) }
    else setCalMonth(calMonth - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0) }
    else setCalMonth(calMonth + 1)
  }

  // ── Week helpers ───────────────────────────────────────────────
  function prevWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d)
  }
  function nextWeek() {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d)
  }

  function getWeekDays() {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d
    })
  }

  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekLabel = weekStart.toLocaleDateString('default', { month: 'short', day: 'numeric' }) +
    ' – ' + weekEnd.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })

  // ── Agenda helpers ─────────────────────────────────────────────
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
  const agendaEvents = events.filter((e) => new Date(e.date) >= todayMidnight)

  function groupByDate(evts: Event[]) {
    const map = new Map<string, Event[]>()
    for (const e of evts) {
      const key = new Date(e.date).toDateString()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }

  if (loading || !group) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-stone-100 border-t-orange-400 animate-spin" />
          <p className="text-sm text-stone-400">Loading calendar…</p>
        </div>
      </div>
    )
  }

  const monthGrid = buildMonthGrid()
  const weekDays = getWeekDays()
  const agendaGroups = groupByDate(agendaEvents)

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
            <h1 className="text-2xl font-bold text-white tracking-tight">Calendar</h1>
            <p className="text-sm text-white/80 mt-0.5">
              {events.filter((e) => new Date(e.date) >= todayMidnight).length} upcoming events
            </p>
          </div>
          <button
            onClick={() => router.push(`/groups/${slug}/create-event`)}
            className="relative z-10 bg-white/20 border border-white/35 hover:bg-white/30 transition-colors text-white text-sm font-semibold rounded-xl px-4 py-2"
          >
            + New event
          </button>
        </div>

        {/* View switcher */}
        <div className="flex gap-2">
          {(['month', 'week', 'agenda'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={[
                'px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 capitalize',
                view === v
                  ? 'bg-gradient-to-r from-orange-400 to-pink-500 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200',
              ].join(' ')}
            >
              {v}
            </button>
          ))}
        </div>

        {/* ── MONTH VIEW ── */}
        {view === 'month' && (
          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors">‹</button>
              <span className="text-sm font-semibold text-stone-900">{calMonthLabel}</span>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors">›</button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-stone-100">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center py-2 text-[10px] font-semibold text-stone-400 uppercase tracking-wide">{d}</div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7">
              {monthGrid.map((cell, idx) => {
                const dayEvents = eventsOnDay(events, cell.date)
                const isToday = isSameDay(cell.date, new Date())
                const isSelected = selectedDay ? isSameDay(cell.date, selectedDay) : false
                const hasConfirmed = dayEvents.some((e) => e.status === 'confirmed')
                const hasProposed = dayEvents.some((e) => e.status !== 'confirmed')

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!cell.thisMonth) return
                      setSelectedDay(isSelected ? null : cell.date)
                    }}
                    className={[
                      'min-h-[64px] p-1.5 border-b border-r border-stone-100 last:border-r-0 transition-colors',
                      cell.thisMonth ? 'cursor-pointer hover:bg-orange-50/30' : 'opacity-30 cursor-default',
                      isSelected ? 'bg-orange-50' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={[
                        'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                        isToday ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white' : cell.thisMonth ? 'text-stone-700' : 'text-stone-300',
                      ].join(' ')}>
                        {cell.date.getDate()}
                      </span>
                      <div className="flex gap-0.5">
                        {hasConfirmed && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                        {hasProposed && <div className="w-1.5 h-1.5 rounded-full bg-stone-300" />}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => (
                        <EventPill key={e.id} event={e} compact getMemberName={getMemberName} onNavigate={() => router.push(`/groups/${slug}/events-hub`)} />
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[9px] text-stone-400 pl-1">+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-stone-100">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-[11px] text-stone-400">Confirmed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-stone-300" />
                <span className="text-[11px] text-stone-400">Proposed</span>
              </div>
            </div>
          </div>
        )}

        {/* Selected day events (month view) */}
        {view === 'month' && selectedDay && eventsOnDay(events, selectedDay).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide px-1">
              {selectedDay.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {eventsOnDay(events, selectedDay).map((e) => (
              <EventPill key={e.id} event={e} getMemberName={getMemberName} onNavigate={() => router.push(`/groups/${slug}/events-hub`)} />
            ))}
          </div>
        )}

        {view === 'month' && selectedDay && eventsOnDay(events, selectedDay).length === 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center">
            <p className="text-stone-400 text-sm">No events on {selectedDay.toLocaleDateString('default', { month: 'long', day: 'numeric' })}</p>
            <button
              onClick={() => router.push(`/groups/${slug}/create-event`)}
              className="mt-3 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 text-white text-xs font-semibold"
            >
              + Add event
            </button>
          </div>
        )}

        {/* ── WEEK VIEW ── */}
        {view === 'week' && (
          <div className="space-y-3">
            {/* Week nav */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
                <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors">‹</button>
                <span className="text-sm font-semibold text-stone-900">{weekLabel}</span>
                <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 transition-colors">›</button>
              </div>

              {/* Week day columns */}
              <div className="grid grid-cols-7 divide-x divide-stone-100">
                {weekDays.map((day, idx) => {
                  const dayEvts = eventsOnDay(events, day)
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div key={idx} className="min-h-[120px] p-1.5">
                      <div className={[
                        'text-center mb-2',
                      ].join('')}>
                        <div className="text-[10px] uppercase tracking-wide text-stone-400 font-semibold">
                          {day.toLocaleDateString('default', { weekday: 'short' })}
                        </div>
                        <div className={[
                          'text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full mt-0.5',
                          isToday ? 'bg-gradient-to-br from-orange-400 to-pink-500 text-white' : 'text-stone-700',
                        ].join(' ')}>
                          {day.getDate()}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        {dayEvts.map((e) => (
                          <EventPill key={e.id} event={e} compact getMemberName={getMemberName} onNavigate={() => router.push(`/groups/${slug}/events-hub`)} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Full event cards for this week */}
            {weekDays.some((day) => eventsOnDay(events, day).length > 0) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide px-1">This week</p>
                {weekDays.flatMap((day) => eventsOnDay(events, day)).map((e) => (
                  <EventPill key={e.id} event={e} getMemberName={getMemberName} onNavigate={() => router.push(`/groups/${slug}/events-hub`)} />
                ))}
              </div>
            )}

            {weekDays.every((day) => eventsOnDay(events, day).length === 0) && (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
                <p className="text-2xl mb-3">📅</p>
                <p className="text-sm font-semibold text-stone-900">No events this week.</p>
                <button
                  onClick={() => router.push(`/groups/${slug}/create-event`)}
                  className="mt-4 px-5 py-2 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 text-white text-sm font-semibold hover:-translate-y-0.5 transition-transform"
                >
                  + Create event
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── AGENDA VIEW ── */}
        {view === 'agenda' && (
          <div className="space-y-5">
            {agendaGroups.size === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center">
                <p className="text-2xl mb-3">📅</p>
                <p className="text-sm font-semibold text-stone-900">No upcoming events yet.</p>
                <button
                  onClick={() => router.push(`/groups/${slug}/create-event`)}
                  className="mt-4 px-5 py-2 rounded-full bg-gradient-to-r from-orange-400 to-pink-500 text-white text-sm font-semibold hover:-translate-y-0.5 transition-transform"
                >
                  Create your first event
                </button>
              </div>
            ) : (
              Array.from(agendaGroups.entries()).map(([dateKey, dayEvts]) => (
                <div key={dateKey} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-stone-900">{formatAgendaDate(dayEvts[0].date)}</span>
                    <span className="text-xs text-stone-400">
                      {new Date(dayEvts[0].date).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <div className="flex-1 h-px bg-stone-100" />
                  </div>
                  {dayEvts.map((e) => (
                    <EventPill key={e.id} event={e} getMemberName={getMemberName} onNavigate={() => router.push(`/groups/${slug}/events-hub`)} />
                  ))}
                </div>
              ))
            )}
          </div>
        )}

      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 flex justify-around items-center py-2 z-10">
        {[
          { icon: '🏠', label: 'Home',     active: false, path: `/dashboard/${slug}` },
          { icon: '📅', label: 'Calendar', active: true,  path: null },
          { icon: '📊', label: 'Polls',    active: false, path: null },
          { icon: '🎯', label: 'Events',   active: false, path: `/groups/${slug}/events-hub` },
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
