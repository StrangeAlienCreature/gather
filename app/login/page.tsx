'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.email) { setError('Please enter your email.'); return; }
    if (!form.password) { setError('Please enter your password.'); return; }

    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (authError) throw authError;

      const userId = authData.user.id;

      // Wait for session to be fully persisted before navigating
      await new Promise<void>((resolve) => {
        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            listener.subscription.unsubscribe();
            resolve();
          }
        });
        setTimeout(resolve, 2000);
      });

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('groups')
        .eq('id', userId)
        .single();
      if (userError) throw userError;

      const groupIds: string[] = userData.groups ?? [];

      if (groupIds.length === 0) {
        router.push('/get-started');
        return;
      }

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('url_slug')
        .eq('id', groupIds[0])
        .single();
      if (groupError) throw groupError;

      router.push(`/dashboard/${groupData.url_slug}`);

    } catch (e: any) {
      if (e.message?.toLowerCase().includes('invalid login')) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(e.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #ff9a56 0%, #ff6b9d 50%, #7c3aed 100%)' }}>
      <nav className="bg-white/90 backdrop-blur px-8 py-4 flex items-center justify-between">
        <Image src="/Asset 1.png" alt="Gather" width={110} height={34} className="object-contain" />
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors px-4 py-2 rounded-full border border-gray-200 hover:border-gray-300">Home</a>
          <a href="/get-started" className="text-sm text-gray-500 hover:text-gray-800 transition-colors px-4 py-2 rounded-full border border-gray-200 hover:border-gray-300">Get Started</a>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white drop-shadow-sm">Welcome back</h1>
            <p className="text-white/80 mt-2 text-sm">
              Don&apos;t have an account?{' '}
              <a href="/get-started" className="text-white font-semibold underline hover:text-white/90">Create one free</a>
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col gap-5">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Email</label>
              <input
                type="email"
                placeholder="example@domain.com"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="email"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
                <span className="text-xs text-violet-500 cursor-pointer hover:text-violet-700 transition-colors">Forgot password?</span>
              </div>
              <input
                type="password"
                placeholder="Your password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="current-password"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 transition"
              />
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
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Signing in...</>
              ) : 'Log in →'}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <a href="/join" className="w-full py-3 rounded-2xl text-sm font-semibold text-center border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
              Join a group with an invite code
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
