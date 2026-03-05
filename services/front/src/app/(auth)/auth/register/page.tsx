"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    pdsUrl: process.env.NEXT_PUBLIC_PDS_URL || 'https://pds2.poltr.info',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // POST email to appview which will send a confirmation email
      const response = await fetch(`/api/xrpc/ch.poltr.auth.register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Registration failed' }));
        throw new Error(errorData.message || `Registration failed: ${response.statusText}`);
      }

      await response.json().catch(() => ({}));
      router.push(`/auth/magic-link-sent?email=${encodeURIComponent(formData.email)}&purpose=registration`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5 bg-gray-100">
      <div className="bg-white p-10 rounded-lg shadow-md w-full max-w-lg">
        <h1 className="mb-2.5">Create POLTR Account</h1>
        <p className="text-gray-500 mb-8">
          Your credentials are randomly generated for security
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label htmlFor="email" className="block mb-2 font-bold">
              Email:
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              required
              disabled={loading}
              className="w-full p-2.5 text-base border border-gray-300 rounded"
            />
          </div>


          {error && (
            <div className="text-red-700 mb-5 p-3 bg-red-50 rounded border border-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="text-green-700 mb-5 p-3 bg-green-50 rounded border border-green-200">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 text-base font-bold text-white border-none rounded mb-4"
            style={{
              backgroundColor: loading ? '#ccc' : '#0085ff',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => router.push('/')}
              disabled={loading}
              className="bg-transparent border-none text-blue-500 cursor-pointer underline text-sm"
            >
              Already have an account? Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
