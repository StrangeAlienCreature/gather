'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Group = {
  id: string;
  name: string;
  description: string;
  url_slug: string;
  members: string[];
  max_members: number;
};

type Mode = 'new' | 'existing';

export default function JoinGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Step 0: enter code, Step 1: auth form
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>('new');

  const [code, setCode] = useState('');

  // Pre-fill code from ?code= query param and auto-advance
  useEffect(() => {
    const urlCode = searchParams.get('code')?.toUpperCase();
    if (!urlCode) return;
    setCode(urlCode);
  }, [searchParams]);
  const [group, setGroup] = useState<Group | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Step 0: look up the group by code ─────────────────────────────────────
  async function handleFindGroup() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError('Please enter an invite code.'); return; }

    setLoading(true);
    setError('');

    try {
      const { data, error: dbError } = await supabase
        .from('groups')
        .select('id, name, description, url_slug, members, max_members')
        .eq('code', trimmed)
        .maybeSingle();

      if (dbError) throw dbError;
      if (!data) { setError('No group found with that code. Double-check and try again.'); return; }
      if (data.members.length >= data.max_members) {
        setError("This group is full and can't accept new members right now.");
        return;
      }

      setGroup(data);
      setStep(1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: create account or log in, then join the group ─────────────────
  async function handleJoin() {
    if (!email) { setError('Please enter your email.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    if (mode === 'new' && !name.trim()) { setError('Please enter your name.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!group) return;

    setLoading(true);
    setError('');

    try {
      let userId: string;

      if (mode === 'new') {
        // Sign up
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (authError) throw authError;
        userId = authData.user!.id;

        const { error: userError } = await supabase.from('users').insert({
          id: userId,
          display_name: name.trim(),
          email,
          groups: [],
        });
        if (userError) throw userError;
      } else {
        // Log in
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        userId = authData.user.id;

        // Check if already a member
        if (group.members.includes(userId)) {
          router.push(`/dashboard/${group.url_slug}`);
          return;
        }
      }

      // Add user to group members
      const { error: groupError } = await supabase
        .from('groups')
        .update({ members: [...group.members, userId] })
        .eq('id', group.id);
      if (groupError) throw groupError;

      // Add group to user's groups
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('groups')
        .eq('id', userId)
        .single();
      if (fetchError) throw fetchError;

      const updatedGroups = [...(userData.groups ?? []), group.id];
      const { error: linkError } = await supabase
        .from('users')
        .update({ groups: updatedGroups })
        .eq('id', userId);
      if (linkError) throw linkError;

      router.push(`/dashboard/${group.url_slug}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      if (msg.toLowerCase().includes('invalid login')) {
        setError('Incorrect email or password. Please try again.');
      } else if (msg.toLowerCase().includes('already registered')) {
        setError('An account with that email already exists. Try logging in instead.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') step === 0 ? handleFindGroup() : handleJoin();
  }

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition';

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #ff9a56 0%, #ff6b9d 50%, #7c3aed 100%)' }}
    >
      {/* Nav */}
      <nav className="bg-white/90 backdrop-blur px-8 py-4 flex items-center justify-between">
        <Image src="/Asset 1.png" alt="Gather" width={110} height={34} className="object-contain" />
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors px-4 py-2 rounded-full border border-gray-200 hover:border-gray-300">
            Home
          </a>
          <a href="/login" className="text-sm text-gray-500 hover:text-gray-800 transition-colors px-4 py-2 rounded-full border border-gray-200 hover:border-gray-300">
            Log in
          </a>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white drop-shadow-sm">Join a group</h1>
            <p className="text-white/80 mt-2 text-sm">
              {step === 0
                ? 'Enter the invite code your friend shared with you.'
                : <>Joining <strong className="text-white">{group?.name}</strong></>}
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col gap-5">

            {/* ── Step 0: Code entry ────────────────────────────────────── */}
            {step === 0 && (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                    Invite code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ABC123"
                    value={code}
                    onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
                    onKeyDown={handleKeyDown}
                    maxLength={8}
                    autoComplete="off"
                    className={`${inputClass} font-mono tracking-widest text-center text-lg uppercase`}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleFindGroup}
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(90deg, #ff6b9d, #7c3aed)' }}
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Looking up group...</>
                  ) : 'Find Group →'}
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400">or</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <a
                  href="/get-started"
                  className="w-full py-3 rounded-2xl text-sm font-semibold text-center border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors block"
                >
                  Create a new group instead
                </a>
              </>
            )}

            {/* ── Step 1: Group info + auth ─────────────────────────────── */}
            {step === 1 && group && (
              <>
                {/* Group preview card */}
                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-medium">Group</span>
                    <span className="text-sm font-semibold text-gray-800">{group.name}</span>
                  </div>
                  {group.description && (
                    <>
                      <div className="h-px bg-gray-200" />
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-medium">About</span>
                        <span className="text-sm text-gray-600 text-right max-w-[60%]">{group.description}</span>
                      </div>
                    </>
                  )}
                  <div className="h-px bg-gray-200" />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 font-medium">Members</span>
                    <span className="text-sm font-medium text-gray-700">
                      {group.members.length} of {group.max_members}
                    </span>
                  </div>
                </div>

                {/* Mode toggle */}
                <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => { setMode('new'); setError(''); }}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                      mode === 'new'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    New to Gather
                  </button>
                  <button
                    onClick={() => { setMode('existing'); setError(''); }}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                      mode === 'existing'
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    I have an account
                  </button>
                </div>

                {/* Auth fields */}
                {mode === 'new' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Name *</label>
                    <input
                      type="text"
                      placeholder="How your friends will know you"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError(''); }}
                      onKeyDown={handleKeyDown}
                      className={inputClass}
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Email *</label>
                  <input
                    type="email"
                    placeholder="example@domain.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={handleKeyDown}
                    autoComplete="email"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
                    {mode === 'new' ? 'Choose a password *' : 'Password *'}
                  </label>
                  <input
                    type="password"
                    placeholder={mode === 'new' ? 'At least 8 characters' : 'Your password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    onKeyDown={handleKeyDown}
                    autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
                    className={inputClass}
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleJoin}
                  disabled={loading}
                  className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                  style={{ background: 'linear-gradient(90deg, #ff6b9d, #7c3aed)' }}
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Joining...</>
                  ) : mode === 'new' ? 'Create account and join ✦' : 'Log in and join →'}
                </button>

                <button
                  onClick={() => { setStep(0); setError(''); setGroup(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
                >
                  ← Use a different code
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
