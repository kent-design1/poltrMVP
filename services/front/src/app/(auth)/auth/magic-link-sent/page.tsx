"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function MagicLinkSentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || 'your email';
  const purpose = searchParams.get('purpose');
  const isRegistration = purpose === 'registration';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-5 text-center">
      <div className="max-w-lg p-10 bg-gray-100 rounded-lg">
        <div className="text-5xl mb-5">
          &#9993;
        </div>
        <h1 className="mb-5">Check your email!</h1>
        <p className="text-base text-gray-500 mb-2.5">
          We&apos;ve sent a {isRegistration ? 'confirmation' : 'magic'} link to:
        </p>
        <p className="text-lg font-bold text-blue-500 mb-8">
          {email}
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Click the link in the email to {isRegistration ? 'complete your registration' : 'log in'}. The link will expire in {isRegistration ? '30' : '15'} minutes.
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2.5 text-sm bg-white text-blue-500 border border-blue-500 rounded cursor-pointer"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}

export default function MagicLinkSent() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    }>
      <MagicLinkSentContent />
    </Suspense>
  );
}
