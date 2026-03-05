"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getBallot, listArguments } from '@/lib/agent';
import { likeBallot, unlikeBallot } from '@/lib/ballots';
import { formatDate } from '@/lib/utils';
import type { BallotWithMetadata, ArgumentWithMetadata } from '@/types/ballots';

export default function BallotDetail() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [ballot, setBallot] = useState<BallotWithMetadata | null>(null);
  const [arguments_, setArguments] = useState<ArgumentWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadData();
  }, [isAuthenticated, authLoading, router, id]);

  const loadData = async () => {
    if (!user || !id) return;
    setLoading(true);
    setError('');

    try {
      const [ballotData, argsData] = await Promise.all([
        getBallot(id),
        listArguments(id),
      ]);
      setBallot(ballotData);
      setArguments(argsData);
    } catch (err) {
      console.error('Error loading ballot detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ballot');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = useCallback(async () => {
    if (!ballot) return;
    const isLiked = !!ballot.viewer?.like;

    setBallot((prev) =>
      prev
        ? {
            ...prev,
            likeCount: (prev.likeCount ?? 0) + (isLiked ? -1 : 1),
            viewer: isLiked ? undefined : { like: '__pending__' },
          }
        : prev
    );

    try {
      if (isLiked) {
        await unlikeBallot(ballot.viewer!.like!);
        setBallot((prev) => (prev ? { ...prev, viewer: undefined } : prev));
      } else {
        const likeUri = await likeBallot(ballot.uri, ballot.cid);
        setBallot((prev) => (prev ? { ...prev, viewer: { like: likeUri } } : prev));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      setBallot((prev) =>
        prev
          ? {
              ...prev,
              likeCount: (prev.likeCount ?? 0) + (isLiked ? 1 : -1),
              viewer: isLiked ? { like: ballot.viewer!.like! } : undefined,
            }
          : prev
      );
    }
  }, [ballot]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Restoring session...
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  const proArgs = arguments_.filter((a) => a.record.type === 'PRO');
  const contraArgs = arguments_.filter((a) => a.record.type === 'CONTRA');

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/ballots')}
              className="px-5 py-2.5 text-sm bg-blue-500 text-white border-none rounded cursor-pointer"
            >
              &#8592; Back to Ballots
            </button>
            <button
              onClick={() => router.push(`/feed/${id}`)}
              className="px-5 py-2.5 text-sm bg-teal-600 text-white border-none rounded cursor-pointer"
            >
              Feed View
            </button>
            <button
              onClick={() => router.push('/review')}
              className="px-5 py-2.5 text-sm bg-violet-500 text-white border-none rounded cursor-pointer"
            >
              Peer Review
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-center p-10 bg-white rounded-lg">
            <p>Loading ballot...</p>
          </div>
        )}

        {error && (
          <div className="p-5 bg-red-50 text-red-700 rounded-lg mb-5 border border-red-200">
            <strong>Error:</strong> {error}
            <button
              onClick={loadData}
              className="ml-5 px-4 py-2 bg-red-700 text-white border-none rounded cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && ballot && (
          <>
            {/* Ballot card */}
            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <div className="flex justify-between items-start mb-4">
                <h1 className="m-0 text-gray-700 text-2xl">
                  {ballot.record.title}
                </h1>
                <div className="flex items-center gap-2">
                  {ballot.record.language && (
                    <span className="text-xs px-2 py-1 bg-blue-50 rounded text-blue-700">
                      {ballot.record.language}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleLike}
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
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {ballot.record.text}
                </p>
              )}

              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  <strong>Vote Date:</strong> {formatDate(ballot.record.voteDate)}
                </div>
                {ballot.record.officialRef && (
                  <div className="text-xs text-gray-400">
                    Ref: {ballot.record.officialRef}
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

            {/* Arguments section */}
            {arguments_.length > 0 && (
              <div>
                <h2 className="m-0 mb-5 text-gray-700">Arguments</h2>
                <div className="grid grid-cols-2 gap-5">
                  {/* PRO column */}
                  <div>
                    <h3 className="m-0 mb-3 text-green-800 text-base uppercase tracking-wide">
                      Pro ({proArgs.length})
                    </h3>
                    <div className="flex flex-col gap-3">
                      {proArgs.map((arg) => (
                        <div
                          key={arg.uri}
                          onClick={() => router.push(`/ballots/${id}/argument/${arg.uri.split('/').pop()}`)}
                          className="bg-white p-4 rounded-lg shadow-sm cursor-pointer"
                          style={{ borderLeft: '4px solid #4caf50' }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="m-0 text-gray-700 text-sm">
                              {arg.record.title}
                            </h4>
                            {arg.reviewStatus === 'preliminary' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 whitespace-nowrap">
                                Preliminary
                              </span>
                            )}
                            {arg.reviewStatus === 'approved' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-800 whitespace-nowrap">
                                Peer-reviewed
                              </span>
                            )}
                            {arg.reviewStatus === 'rejected' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-800 whitespace-nowrap">
                                Rejected
                              </span>
                            )}
                          </div>
                          <p className="m-0 mb-2 text-sm text-gray-600 leading-normal">
                            {arg.record.body}
                          </p>
                          <div className="text-xs text-gray-400">
                            {(arg.likeCount ?? 0) > 0 && (
                              <span>{'\u2661'} {arg.likeCount}</span>
                            )}
                            {(arg.commentCount ?? 0) > 0 && (
                              <span className="ml-3">
                                {arg.commentCount} comment{arg.commentCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {proArgs.length === 0 && (
                        <p className="text-gray-400 text-sm">No pro arguments yet.</p>
                      )}
                    </div>
                  </div>

                  {/* CONTRA column */}
                  <div>
                    <h3 className="m-0 mb-3 text-red-800 text-base uppercase tracking-wide">
                      Contra ({contraArgs.length})
                    </h3>
                    <div className="flex flex-col gap-3">
                      {contraArgs.map((arg) => (
                        <div
                          key={arg.uri}
                          onClick={() => router.push(`/ballots/${id}/argument/${arg.uri.split('/').pop()}`)}
                          className="bg-white p-4 rounded-lg shadow-sm cursor-pointer"
                          style={{ borderLeft: '4px solid #ef5350' }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="m-0 text-gray-700 text-sm">
                              {arg.record.title}
                            </h4>
                            {arg.reviewStatus === 'preliminary' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 whitespace-nowrap">
                                Preliminary
                              </span>
                            )}
                            {arg.reviewStatus === 'approved' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-800 whitespace-nowrap">
                                Peer-reviewed
                              </span>
                            )}
                            {arg.reviewStatus === 'rejected' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-800 whitespace-nowrap">
                                Rejected
                              </span>
                            )}
                          </div>
                          <p className="m-0 mb-2 text-sm text-gray-600 leading-normal">
                            {arg.record.body}
                          </p>
                          <div className="text-xs text-gray-400">
                            {(arg.likeCount ?? 0) > 0 && (
                              <span>{'\u2661'} {arg.likeCount}</span>
                            )}
                            {(arg.commentCount ?? 0) > 0 && (
                              <span className="ml-3">
                                {arg.commentCount} comment{arg.commentCount !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {contraArgs.length === 0 && (
                        <p className="text-gray-400 text-sm">No contra arguments yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {arguments_.length === 0 && !loading && (
              <div className="text-center p-10 bg-white rounded-lg text-gray-500">
                No arguments have been submitted for this ballot yet.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
