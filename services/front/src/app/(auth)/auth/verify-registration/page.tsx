"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/spinner';

function VerifyRegistrationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, type: 'registration' }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Verification failed');
        }

        login({
          did: data.user.did,
          handle: data.user.handle,
          displayName: data.user.displayName,
        });

        setStatus('success');
        setTimeout(() => router.push('/home'), 2000);
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      }
    };

    verifyToken();
  }, [searchParams, router, login]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5">
      <Card className="w-full max-w-sm text-center">
        <CardContent className="pt-6 space-y-4">
          {status === 'verifying' && (
            <>
              <Spinner className="mx-auto" size="lg" />
              <h2 className="text-lg font-semibold">Verifying your registration...</h2>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-5xl">&#9989;</div>
              <h2 className="text-lg font-semibold text-primary">Registration Complete!</h2>
              <p className="text-muted-foreground">
                Redirecting you to the app...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-5xl">&#10060;</div>
              <h2 className="text-lg font-semibold text-destructive">Verification Failed</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={() => router.push('/')}>
                Back to Login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyRegistration() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    }>
      <VerifyRegistrationContent />
    </Suspense>
  );
}
