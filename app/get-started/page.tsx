'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function generateGroupCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function GetStarted() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    groupName: '',
    groupDescription: '',
    urlSlug: '',
  });

  const update = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'groupName') next.urlSlug = slugify(value);
      return next;
    });
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Please enter a valid email.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords don't match."); return; }
    if (!form.groupName.trim()) { setError('Please enter a group name.'); return; }
    if (!form.urlSlug) { setError('Please enter a URL for your group.'); return; }
    if (!/^[a-z0-9-]+$/.test(form.urlSlug)) { setError('URL can only contain lowercase letters, numbers, and hyphens.'); return; }

    setLoading(true);
    setError('');

    try {
      const { data: existing } = await supabase
        .from('groups')
        .select('id')
        .eq('url_slug', form.urlSlug)
        .maybeSingle();

      if (existing) {
        setError('That group URL is already taken. Try a different one.');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { display_name: form.name } },
      });
      if (authError) throw authError;
      const userId = authData.user!.id;

      const { error: userError } = await supabase.from('users').insert({
        id: userId,
        display_name: form.name,
        email: form.email,
        groups: [],
      });
      if (userError) throw userError;

      const groupCode = generateGroupCode();
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: form.groupName,
          description: form.groupDescription,
          code: groupCode,
          url_slug: form.urlSlug,
          owner_id: userId,
          members: [userId],
          max_members: 12,
        })
        .select()
        .single();
      if (groupError) throw groupError;

      const { error: linkError } = await supabase
        .from('users')
        .update({ groups: [group.id] })
        .eq('id', userId);
      if (linkError) throw linkError;

      router.push(`/dashboard/${form.urlSlug}`);

    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Poll your friends to vote on an activity',
    'Rich link embeds for quick info about activity suggestions',
    'Set your availability so friends can see it when making plans',
    'Shared calendar and group dashboard for planning events',
    '"Things to know" section for quick info on events — bring a swimsuit!',
    'Assign tasks to friends, no more arguing about who brings what',
    'See activity costs at a glance',
  ];

  return (
    <main className="min-h-screen" style={{ background: 'linear-gradient(135deg, #ff9a56 0%, #ff6b9d 50%, #7c3aed 100%)' }}>
      <nav className="bg-white/90 backdrop-blur px-8 py-4 flex items-center justify-between">
        <Image src="/Asset 1.png" alt="Gather" width={110} height={34} className="object-contain" />
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors px-4 py-2 rounded-full border border-gray-200 hover:border-gray-300">Home</a>
          <span className="text-sm font-semibold text-white bg-gray-900 px-4 py-2 rounded-full">Get Started</span>
        </div>
      </nav>

      <div className="text-center pt-12 pb-8 px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-sm">Create Your Account</h1>
        <p className="text-white/80 mt-2 text-sm">
          Already have an account?{' '}
          <a href="/login" className="underline text-white font-medium hover:text-white/90">Log in</a>
          {' · '}
          <a href="/join" className="underline text-white font-medium hover:text-white/90">Joining a group instead?</a>
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-16 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="text-white">
          <h2 className="text-2xl font-bold mb-6 leading-snug">Gather makes it easy to plan with your friends.</h2>
          <ul className="flex flex-col gap-3">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/90">
                <span className="mt-0.5 text-white/60">•</span>
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-white/70 text-sm italic">Get started today and enjoy chaos-free planning.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col gap-5">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Email *</label>
            <input type="email" placeholder="example@domain.com" value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Name *</label>
            <input type="text" placeholder="John Doe" value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Choose a password *</label>
            <input type="password" placeholder="At least 8 characters" value={form.password} onChange={(e) => update('password', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Confirm password *</label>
            <input type="password" placeholder="Repeat your password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
          </div>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">Your group</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Name your group *</label>
            <input type="text" placeholder="Surf Squad" value={form.groupName} onChange={(e) => update('groupName', e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
              Group description <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea placeholder="Our group meets on Fridays" value={form.groupDescription} onChange={(e) => update('groupDescription', e.target.value)} rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition resize-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Group URL *</label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-violet-400 transition">
              <span className="px-3 py-3 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 whitespace-nowrap">gatherplanning.com/dashboard/</span>
              <input type="text" placeholder="surfsquad" value={form.urlSlug} onChange={(e) => update('urlSlug', slugify(e.target.value))} className="flex-1 px-3 py-3 text-sm focus:outline-none" />
            </div>
            <p className="text-xs text-gray-400 mt-1">Auto-filled from your group name — you can edit it.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
            style={{ background: 'linear-gradient(90deg, #ff6b9d, #7c3aed)' }}
          >
            {loading ? 'Creating your group...' : <>Create Group and Sign Up ✦</>}
          </button>
        </div>
      </div>
    </main>
  );
}