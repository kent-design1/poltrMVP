"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

function VerifyRegistrationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    // Prevent double verification in StrictMode
    if (hasVerified.current) return;
    hasVerified.current = true;

    const verifyToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setError('Invalid or missing token');
        return;
      }

      try {
        const response = await fetch(`/api/auth/verify-registration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, type: 'registration' }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Verification failed');
        }

        // Store user data (session token is set as httpOnly cookie by the API route)
        login({
          did: data.user.did,
          handle: data.user.handle,
          displayName: data.user.displayName,
        });

        setStatus('success');

        // Redirect to home after 2 seconds
        setTimeout(() => {
          router.push('/home');
        }, 2000);

      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    };

    verifyToken();
  }, [searchParams, router, login]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5 text-center">
      {status === 'verifying' && (
        <div>
          <div className="text-5xl mb-5" style={{ animation: 'spin 1s linear infinite' }}>
            &#8987;
          </div>
          <h2>Verifying your registration...</h2>
        </div>
      )}

      {status === 'success' && (
        <div>
          <div className="text-5xl mb-5">
            &#9989;
          </div>
          <h2 className="text-blue-500">Registration Complete!</h2>
          <p className="text-gray-500 mt-2.5">
            Redirecting you to the app...
          </p>
        </div>
      )}

      {status === 'error' && (
        <div>
          <div className="text-5xl mb-5">
            &#10060;
          </div>
          <h2 className="text-red-500">Verification Failed</h2>
          <p className="text-gray-500 mt-2.5 mb-5">
            {error}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 text-base bg-blue-500 text-white border-none rounded cursor-pointer"
          >
            Back to Login
          </button>
        </div>
      )}
    </div>
  );
}

export default function VerifyRegistration() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    }>
      <VerifyRegistrationContent />
    </Suspense>
  );
}
