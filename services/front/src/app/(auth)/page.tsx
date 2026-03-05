"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/xrpc/ch.poltr.auth.sendMagicLink`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server error — please try again later');
      }

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send magic link');
      }

      // Navigate to confirmation page with email as query param
      router.push(`/auth/magic-link-sent?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5">
      <h1>Login to POLTR</h1>
      <p className="mb-8 text-gray-500">
        Enter your email to login to poltr.
      </p>
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="mb-5">
          <label htmlFor="email" className="block mb-2">
            Email address:
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={loading}
            className="w-full p-2.5 text-base border border-gray-300 rounded"
          />
        </div>
        {error && (
          <div className="text-red-500 mb-5 p-2.5 bg-red-50 rounded">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 text-base text-white border-none rounded mb-4"
          style={{
            backgroundColor: loading ? '#ccc' : '#0085ff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => router.push('/auth/register')}
            disabled={loading}
            className="bg-transparent border-none text-blue-500 cursor-pointer underline text-sm"
          >
            Don&apos;t have an account? Register
          </button>
        </div>
      </form>
    </div>
  );
}
