"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/spinner';

function MagicLinkSentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || 'your email';
  const purpose = searchParams.get('purpose');
  const isRegistration = purpose === 'registration';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="text-5xl mb-2">&#9993;</div>
          <CardTitle className="text-2xl">Check your email!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We&apos;ve sent a {isRegistration ? 'confirmation' : 'magic'} link to:
          </p>
          <p className="text-lg font-bold text-primary">
            {email}
          </p>
          <p className="text-sm text-muted-foreground">
            Click the link in the email to {isRegistration ? 'complete your registration' : 'log in'}. The link will expire in {isRegistration ? '30' : '15'} minutes.
          </p>
          <Button variant="outline" onClick={() => router.push('/')}>
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MagicLinkSent() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    }>
      <MagicLinkSentContent />
    </Suspense>
  );
}
