"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getOAuthClient } from '@/lib/oauthClient';

export default function Callback() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution in React strict mode
    if (hasProcessed.current) {
      return;
    }
    hasProcessed.current = true;

    const handleCallback = async () => {
      try {
        const client = await getOAuthClient();

        // Complete the OAuth callback with URLSearchParams
        // Check both hash fragment and query string
        const hashParams = window.location.hash ? window.location.hash.substring(1) : '';
        const queryParams = window.location.search ? window.location.search.substring(1) : '';
        const paramString = hashParams || queryParams;
        const params = new URLSearchParams(paramString);

        const result = await client.callback(params);

        if (!result) {
          throw new Error('No session returned from callback');
        }

        // Get session info
        const session = result.session;
        const did = session.did;

        // Get the actual handle and profile info
        let handle: string = did;
        let displayName: string = 'User';

        try {
          // Fetch profile from PDS to get actual handle
          const profileUrl = `https://bsky.social/xrpc/com.atproto.repo.describeRepo?repo=${did}`;
          const profileResponse = await fetch(profileUrl);

          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            handle = profileData.handle || did;
            displayName = profileData.displayName || handle;
          }
        } catch (e) {
          console.log('Could not fetch profile, using DID');
          // Fallback to a short display of the DID
          const didShort = did.replace('did:plc:', '').substring(0, 10) + '...';
          handle = didShort;
          displayName = didShort;
        }

        // Store user info and redirect to home
        login({
          did: did,
          handle: handle,
          displayName: displayName
        });

        router.push('/home');
      } catch (err) {
        console.error('Callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [router, login]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-5">
        <h1>Authentication Error</h1>
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-5 px-6 py-3 text-base bg-blue-500 text-white border-none rounded cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <h2>Authenticating...</h2>
    </div>
  );
}
