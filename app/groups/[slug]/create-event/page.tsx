'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkPreview {
  title: string;
  description: string;
  image: string;
  domain: string;
}

interface Task {
  id: string;
  label: string;
  assigned_to: string | null; // null = open for anyone to self-assign
}

interface GroupMember {
  id: string;
  display_name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function isUrl(text: string) {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const ACCESSIBILITY_FLAGS = [
  { key: 'step_free',          label: 'Step-free access',     emoji: '♿' },
  { key: 'elevator',           label: 'Elevator on site',     emoji: '🛗' },
  { key: 'limited_walking',    label: 'Limited walking',      emoji: '🚶' },
  { key: 'seating_available',  label: 'Seating available',    emoji: '🪑' },
  { key: 'accessible_parking', label: 'Accessible parking',   emoji: '🅿️' },
  { key: 'loud_environment',   label: 'Loud / busy space',    emoji: '🔊' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateEventPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();

  // ── Auth / group state
  const [userId, setUserId]       = useState<string | null>(null);
  const [groupId, setGroupId]     = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers]     = useState<GroupMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [step, setStep]           = useState<'form' | 'success'>('form');

  // ── Core fields
  const [title, setTitle]         = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [location, setLocation]   = useState('');
  const [locationUrl, setLocationUrl] = useState('');

  // ── Host info
  const [hostName, setHostName]   = useState('');
  const [hostPhone, setHostPhone] = useState('');

  // ── Activity link + rich preview
  const [activityUrl, setActivityUrl]     = useState('');
  const [linkPreview, setLinkPreview]     = useState<LinkPreview | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Things to know
  const [thingsToKnow, setThingsToKnow] = useState('');

  // ── Cost
  const [costPerPerson, setCostPerPerson] = useState('');

  // ── Accessibility
  const [accessibilityFlags, setAccessibilityFlags] = useState<string[]>([]);
  const [accessibilityNotes, setAccessibilityNotes] = useState('');

  // ── Tasks
  const [tasks, setTasks] = useState<Task[]>([]);

  // ── Template
  const [isTemplate, setIsTemplate]     = useState(false);
  const [templateName, setTemplateName] = useState('');

  // ── Load user + group
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data: group } = await supabase
        .from('groups')
        .select('id, name, members')
        .eq('url_slug', slug)
        .single();

      if (!group) { router.push('/'); return; }

      const memberIds: string[] = group.members || [];
      if (!memberIds.includes(user.id)) { router.push('/'); return; }

      setGroupId(group.id);
      setGroupName(group.name);

      const { data: memberData } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', memberIds);

      const memberList = memberData ?? [];
      setMembers(memberList);

      // Pre-fill host name from the creator's profile
      const self = memberList.find((m: GroupMember) => m.id === user.id);
      if (self?.display_name) setHostName(self.display_name);

      setLoading(false);
    }
    load();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Link preview fetch ──────────────────────────────────────────────────────

  async function fetchLinkPreview(url: string) {
    setFetchingPreview(true);
    try {
      const res = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false`
      );
      const json = await res.json();
      if (json.status === 'success') {
        setLinkPreview({
          title:       json.data.title       || '',
          description: json.data.description || '',
          image:       json.data.image?.url  || '',
          domain:      new URL(url).hostname.replace('www.', ''),
        });
      } else {
        setLinkPreview(null);
      }
    } catch {
      setLinkPreview(null);
    } finally {
      setFetchingPreview(false);
    }
  }

  function handleActivityUrlChange(value: string) {
    setActivityUrl(value);
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (isUrl(value)) {
      previewTimer.current = setTimeout(() => fetchLinkPreview(value), 700);
    } else {
      setLinkPreview(null);
    }
  }

  // ─── Task helpers ─────────────────────────────────────────────────────────────

  function addTask() {
    setTasks(prev => [...prev, { id: generateId(), label: '', assigned_to: null }]);
  }

  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function updateTask(id: string, patch: Partial<Task>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }

  // ─── Accessibility toggle ─────────────────────────────────────────────────────

  function toggleFlag(key: string) {
    setAccessibilityFlags(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }

  // ─── Validation ──────────────────────────────────────────────────────────────

  function validate(): string {
    if (!title.trim()) return 'Please give your event a name.';
    if (!startDate)    return 'Please choose a date for the event.';
    if (isTemplate && !templateName.trim()) return 'Please give your template a name.';
    return '';
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);

    try {
      const dateTime = startTime
        ? new Date(`${startDate}T${startTime}`).toISOString()
        : new Date(startDate).toISOString();

      const endDateTime = endTime
        ? new Date(`${startDate}T${endTime}`).toISOString()
        : null;

      const eventData: Record<string, unknown> = {
        group_id:     groupId,
        title:        title.trim(),
        date:         dateTime,
        end_date:     endDateTime,
        location:     location.trim()    || null,
        location_url: locationUrl.trim() || null,
        status:       'confirmed',
        created_by:   userId,
        attendees:    [userId],
        // Rich link
        activity_url:     activityUrl       || null,
        link_title:       linkPreview?.title       || null,
        link_description: linkPreview?.description || null,
        link_image:       linkPreview?.image       || null,
        link_domain:      linkPreview?.domain      || null,
        // Host
        host_name:  hostName.trim()  || null,
        host_phone: hostPhone.trim() || null,
        // Details
        things_to_know:       thingsToKnow.trim()    || null,
        cost_per_person:      costPerPerson.trim()   || null,
        accessibility_flags:  accessibilityFlags.length > 0 ? accessibilityFlags : null,
        accessibility_notes:  accessibilityNotes.trim() || null,
        tasks: tasks
          .filter(t => t.label.trim())
          .map(t => ({ id: t.id, label: t.label.trim(), assigned_to: t.assigned_to })),
        // Template
        is_template:   isTemplate,
        template_name: isTemplate ? templateName.trim() : null,
        created_date:  new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('events')
        .insert(eventData);

      if (insertError) throw insertError;

      setStep('success');
    } catch (e: unknown) {
      console.error(e);
      setError('Something went wrong creating your event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading screen ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  // ─── Success screen ───────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-100 h-14 flex items-center px-6">
          <div className="max-w-2xl mx-auto w-full">
            <span className="font-bold text-gray-800 text-lg tracking-tight">
              G<span className="bg-gradient-to-r from-orange-400 via-pink-500 to-violet-700 bg-clip-text text-transparent">ather</span>
            </span>
          </div>
        </nav>

        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-violet-700 flex items-center justify-center mx-auto mb-6">
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">Event created! 🎉</h1>
          <p className="text-gray-500 text-sm mb-10">
            Your event has been added to {groupName}&apos;s calendar.
          </p>

          <button
            onClick={() => router.push(`/dashboard/${slug}`)}
            className="w-full py-4 rounded-2xl font-bold text-white text-base"
            style={{ background: 'linear-gradient(135deg, #fb923c, #ec4899, #7c3aed)' }}
          >
            Back to dashboard →
          </button>
        </div>
      </div>
    );
  }

  // ─── Main form ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 h-14 flex items-center px-6 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <button
            onClick={() => router.push(`/dashboard/${slug}`)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to {groupName}
          </button>
          <span className="font-bold text-gray-800 text-lg tracking-tight">
            G<span className="bg-gradient-to-r from-orange-400 via-pink-500 to-violet-700 bg-clip-text text-transparent">ather</span>
          </span>
          <span className="w-24" />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-16">

        <div className="mb-7">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Create an event</h1>
          <p className="text-sm text-gray-400 mt-1">Add details so everyone knows what to expect</p>
        </div>

        <div className="space-y-4">

          {/* ── Event details ───────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-4">Event details</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Event name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Game night at Jamie's place"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Start time <span className="font-normal text-gray-300">· optional</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  End time <span className="font-normal text-gray-300">· optional</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Cost per person <span className="font-normal text-gray-300">· optional</span>
                </label>
                <input
                  type="text"
                  value={costPerPerson}
                  onChange={e => setCostPerPerson(e.target.value)}
                  placeholder="e.g. Free, $15/person"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Location <span className="font-normal text-gray-300">· optional</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Jamie's place, Central Park, The Rusty Anchor"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Maps / directions link <span className="font-normal text-gray-300">· optional</span>
              </label>
              <input
                type="url"
                value={locationUrl}
                onChange={e => setLocationUrl(e.target.value)}
                placeholder="Paste a Google Maps or Apple Maps link"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
              />
            </div>
          </section>

          {/* ── Host info ───────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-1">Host info</p>
            <p className="text-xs text-gray-400 mb-4">
              Who can members reach out to with questions? A phone number is great for less tech-savvy guests.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Host name</label>
                <input
                  type="text"
                  value={hostName}
                  onChange={e => setHostName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone number <span className="font-normal text-gray-300">· optional</span>
                </label>
                <input
                  type="tel"
                  value={hostPhone}
                  onChange={e => setHostPhone(e.target.value)}
                  placeholder="e.g. 555-867-5309"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </section>

          {/* ── Activity link ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-1">Activity link</p>
            <p className="text-xs text-gray-400 mb-4">
              Add a link to a venue, restaurant, or activity page — we&apos;ll pull in the details automatically.
            </p>
            <input
              type="url"
              value={activityUrl}
              onChange={e => handleActivityUrlChange(e.target.value)}
              placeholder="Paste a URL…"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
            />

            {fetchingPreview && (
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                Fetching preview…
              </div>
            )}

            {linkPreview && !fetchingPreview && (
              <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden flex">
                {linkPreview.image && (
                  <img
                    src={linkPreview.image}
                    alt=""
                    className="w-20 h-20 object-cover flex-shrink-0"
                  />
                )}
                <div className="p-3 flex flex-col justify-center min-w-0">
                  <p className="text-[10px] text-gray-400 mb-0.5">{linkPreview.domain}</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{linkPreview.title}</p>
                  {linkPreview.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{linkPreview.description}</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* ── Things to know ──────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-1">Things to know</p>
            <p className="text-xs text-gray-400 mb-4">
              Parking tips, what to bring, dress code — anything useful for attendees.
            </p>
            <textarea
              value={thingsToKnow}
              onChange={e => setThingsToKnow(e.target.value)}
              placeholder="e.g. Street parking is easy on Oak St. Bring a blanket if you run cold. No dress code — come casual!"
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors resize-none"
            />
          </section>

          {/* ── Accessibility ────────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-1">Accessibility</p>
            <p className="text-xs text-gray-400 mb-4">
              Help everyone know what to expect at this venue so they can plan ahead.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {ACCESSIBILITY_FLAGS.map(flag => {
                const active = accessibilityFlags.includes(flag.key);
                return (
                  <button
                    key={flag.key}
                    type="button"
                    onClick={() => toggleFlag(flag.key)}
                    className="text-left px-3 py-2.5 rounded-xl border-2 text-sm transition-all"
                    style={{
                      borderColor: active ? '#7c3aed' : '#e5e7eb',
                      background:  active ? '#faf9ff' : 'white',
                      color:       active ? '#7c3aed' : '#374151',
                    }}
                  >
                    <span className="mr-2">{flag.emoji}</span>
                    {flag.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={accessibilityNotes}
              onChange={e => setAccessibilityNotes(e.target.value)}
              placeholder="Any other accessibility notes…"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors resize-none"
            />
          </section>

          {/* ── Assignable tasks ─────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-1">Tasks</p>
            <p className="text-xs text-gray-400 mb-4">
              Assign jobs to specific people, or leave them open for anyone to claim.
            </p>

            {tasks.length > 0 && (
              <div className="space-y-2 mb-3">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
                    <input
                      type="text"
                      value={task.label}
                      onChange={e => updateTask(task.id, { label: e.target.value })}
                      placeholder="e.g. Bring appetizers, Pick up cups and plates"
                      className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-300 focus:outline-none"
                    />
                    <select
                      value={task.assigned_to ?? ''}
                      onChange={e => updateTask(task.id, { assigned_to: e.target.value || null })}
                      className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-500 transition-colors max-w-[140px]"
                    >
                      <option value="">Open — anyone can claim</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.display_name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeTask(task.id)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-sm font-bold flex-shrink-0 bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addTask}
              className="flex items-center gap-1.5 text-sm text-violet-600 font-medium hover:text-violet-800 transition-colors"
            >
              <span className="w-5 h-5 rounded-full border-2 border-violet-400 flex items-center justify-center text-violet-500 text-xs font-bold leading-none">+</span>
              Add a task
            </button>
          </section>

          {/* ── Save as template ─────────────────────────────────────────────── */}
          <section className="bg-white rounded-2xl p-5 border border-gray-100">
            <button
              type="button"
              onClick={() => setIsTemplate(prev => !prev)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: '#f5f3ff' }}
                >
                  📋
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">Save as template</p>
                  <p className="text-xs text-gray-400 mt-0.5">Reuse this layout for future events like D&amp;D night or study group</p>
                </div>
              </div>
              {/* Toggle pill */}
              <div
                className="w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 relative ml-4"
                style={{ background: isTemplate ? 'linear-gradient(135deg, #fb923c, #ec4899, #7c3aed)' : '#e5e7eb' }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                  style={{ transform: isTemplate ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </div>
            </button>

            {isTemplate && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Template name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="e.g. D&D Night, Monthly Book Club, Study Session"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
                />
              </div>
            )}
          </section>

          {/* ── Error ────────────────────────────────────────────────────────── */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* ── Submit ───────────────────────────────────────────────────────── */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-2xl font-bold text-white text-base disabled:opacity-60 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #fb923c, #ec4899, #7c3aed)' }}
          >
            {submitting ? 'Creating event…' : 'Create event'}
          </button>

        </div>
      </div>
    </div>
  );
}
