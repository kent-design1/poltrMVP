"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { listBallots } from '@/lib/agent';
import { likeBallot, unlikeBallot } from '@/lib/ballots';
import { formatDate } from '@/lib/utils';
import type { BallotWithMetadata } from '@/types/ballots';



export default function BallotSearch() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [ballots, setBallots] = useState<BallotWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return; // wait for auth restoration
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadBallots();
  }, [isAuthenticated, authLoading, router]);

  const loadBallots = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {

      const ballots: BallotWithMetadata[] = await listBallots()
      console.log('Fetched ballots:', ballots);

      setBallots(ballots || []);
    } catch (err) {
      console.error('Error loading ballots:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ballots');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = useCallback(async (ballot: BallotWithMetadata) => {
    const isLiked = !!ballot.viewer?.like;

    // Optimistic update
    setBallots((prev) =>
      prev.map((b) =>
        b.uri === ballot.uri
          ? {
              ...b,
              likeCount: (b.likeCount ?? 0) + (isLiked ? -1 : 1),
              viewer: isLiked ? undefined : { like: '__pending__' },
            }
          : b
      )
    );

    try {
      if (isLiked) {
        await unlikeBallot(ballot.viewer!.like!);
        setBallots((prev) =>
          prev.map((b) =>
            b.uri === ballot.uri ? { ...b, viewer: undefined } : b
          )
        );
      } else {
        const likeUri = await likeBallot(ballot.uri, ballot.cid);
        setBallots((prev) =>
          prev.map((b) =>
            b.uri === ballot.uri ? { ...b, viewer: { like: likeUri } } : b
          )
        );
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      // Revert optimistic update
      setBallots((prev) =>
        prev.map((b) =>
          b.uri === ballot.uri
            ? {
                ...b,
                likeCount: (b.likeCount ?? 0) + (isLiked ? 1 : -1),
                viewer: isLiked ? { like: ballot.viewer!.like! } : undefined,
              }
            : b
        )
      );
    }
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Restoring session...
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="m-0">Swiss Ballot Entries.</h1>
          <button
            onClick={() => router.push('/home')}
            className="px-5 py-2.5 text-sm bg-blue-500 text-white border-none rounded cursor-pointer"
          >
            &#8592; Back to Home
          </button>
        </div>

      {loading && (
        <div className="text-center p-10 bg-white rounded-lg">
          <p>Loading ballots...</p>
        </div>
      )}

      {error && (
        <div className="p-5 bg-red-50 text-red-700 rounded-lg mb-5 border border-red-200">
          <strong>Error:</strong> {error}
          <button
            onClick={loadBallots}
            className="ml-5 px-4 py-2 bg-red-700 text-white border-none rounded cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && ballots.length === 0 && (
        <div className="text-center p-10 bg-white rounded-lg">
          <p className="text-gray-500 text-lg">
            No ballot entries found.
          </p>
        </div>
      )}

      {!loading && ballots.length > 0 && (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {ballots.map((ballot) => {
            const rkey = ballot.uri.split('/').pop();
            return (
            <div
              key={ballot.uri}
              onClick={() => rkey && router.push(`/ballots/${rkey}`)}
              className="bg-white p-5 rounded-lg shadow cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex justify-between items-start mb-2.5">
                <h3 className="m-0 mb-2.5 text-gray-700 text-lg">
                  {ballot.record.title}
                </h3>
                <div className="flex items-center gap-2">
                  {ballot.record.language && (
                    <span className="text-xs px-2 py-1 bg-blue-50 rounded text-blue-700">
                      {ballot.record.language}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleLike(ballot);
                    }}
                    title={ballot.viewer?.like ? 'Unlike' : 'Like'}
                    className="bg-transparent border border-transparent p-0.5 text-xl cursor-pointer transition-colors duration-200"
                    style={{ color: ballot.viewer?.like ? '#d81b60' : '#b0bec5' }}
                  >
                    {ballot.viewer?.like ? '\u2764' : '\u2661'}
                    {(ballot.likeCount ?? 0) > 0 && (
                      <span className="text-xs ml-1">
                        {ballot.likeCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {ballot.record.topic && (
                <div className="text-sm text-gray-500 mb-2">
                  <strong>Topic:</strong> {ballot.record.topic}
                </div>
              )}

              {ballot.record.text && (
                <p className="text-sm text-gray-500 mb-3 leading-normal line-clamp-3">
                  {ballot.record.text}
                </p>
              )}

              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  <strong>Vote Date:</strong><br />
                  {formatDate(ballot.record.voteDate)}
                </div>
                {ballot.record.officialRef && (
                  <div className="text-xs text-gray-400">
                    Ref: (1) {ballot.record.officialRef}
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                {(ballot.argumentCount ?? 0) > 0 && (
                  <span>{ballot.argumentCount} argument{ballot.argumentCount !== 1 ? 's' : ''}</span>
                )}
                {(ballot.commentCount ?? 0) > 0 && (
                  <span>{ballot.commentCount} comment{ballot.commentCount !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

      {!loading && ballots.length > 0 && (
        <div className="mt-8 text-center text-gray-500">
          Found {ballots.length} ballot{ballots.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  </div>
);
}
