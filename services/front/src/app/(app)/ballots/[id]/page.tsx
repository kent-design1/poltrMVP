"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getBallot, listArguments } from '@/lib/agent';
import { likeBallot, unlikeBallot } from '@/lib/ballots';
import { formatDate } from '@/lib/utils';
import type { BallotWithMetadata, ArgumentWithMetadata } from '@/types/ballots';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/spinner';
import { ReviewStatusBadge } from '@/components/pro-contra-badge';
import { FullWidthDivider } from '@/components/full-width-divider';

function ArgumentCard({ arg, onClick, borderColor }: { arg: ArgumentWithMetadata; onClick: () => void; borderColor: string }) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      style={{ borderLeft: `4px solid ${borderColor}` }}
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex justify-between items-start mb-2">
          <h4 className="m-0 text-sm font-medium">
            {arg.record.title}
          </h4>
          <ReviewStatusBadge status={arg.reviewStatus} />
        </div>
        <p className="m-0 mb-2 text-sm text-muted-foreground leading-normal">
          {arg.record.body}
        </p>
        <div className="flex gap-3 text-xs text-muted-foreground">
          {(arg.likeCount ?? 0) > 0 && (
            <span>{'\u2661'} {arg.likeCount}</span>
          )}
          {(arg.commentCount ?? 0) > 0 && (
            <span>{arg.commentCount} comment{arg.commentCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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
      <div className="flex items-center justify-center min-h-[50vh] gap-3">
        <Spinner />
        <span className="text-muted-foreground">Restoring session...</span>
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  const proArgs = arguments_.filter((a) => a.record.type === 'PRO');
  const contraArgs = arguments_.filter((a) => a.record.type === 'CONTRA');

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push('/ballots')}>
          &larr; Back to Ballots
        </Button>
        <Button variant="secondary" size="sm" onClick={() => router.push(`/feed/${id}`)}>
          Feed View
        </Button>
        <Button variant="secondary" size="sm" onClick={() => router.push('/review')}>
          Peer Review
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-10 gap-3">
            <Spinner />
            <span className="text-muted-foreground">Loading ballot...</span>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span><strong>Error:</strong> {error}</span>
            <Button variant="destructive" size="sm" onClick={loadData}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && ballot && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-4">
                <h1 className="m-0 text-2xl font-bold">{ballot.record.title}</h1>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {ballot.record.language && (
                    <Badge variant="secondary">{ballot.record.language}</Badge>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleLike}
                    title={ballot.viewer?.like ? 'Unlike' : 'Like'}
                    className="bg-transparent border-none p-0.5 text-xl cursor-pointer transition-colors duration-200"
                    style={{ color: ballot.viewer?.like ? '#d81b60' : '#b0bec5' }}
                  >
                    {ballot.viewer?.like ? '\u2764' : '\u2661'}
                    {(ballot.likeCount ?? 0) > 0 && (
                      <span className="text-xs ml-1">{ballot.likeCount}</span>
                    )}
                  </button>
                </div>
              </div>

              {ballot.record.topic && (
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Topic:</strong> {ballot.record.topic}
                </p>
              )}

              {ballot.record.text && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {ballot.record.text}
                </p>
              )}

              <Separator className="my-4" />

              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  <strong>Vote Date:</strong> {formatDate(ballot.record.voteDate)}
                </div>
                {ballot.record.officialRef && (
                  <span className="text-xs text-muted-foreground">Ref: {ballot.record.officialRef}</span>
                )}
              </div>

              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                {(ballot.argumentCount ?? 0) > 0 && (
                  <span>{ballot.argumentCount} argument{ballot.argumentCount !== 1 ? 's' : ''}</span>
                )}
                {(ballot.commentCount ?? 0) > 0 && (
                  <span>{ballot.commentCount} comment{ballot.commentCount !== 1 ? 's' : ''}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {arguments_.length > 0 && (
            <div>
              <FullWidthDivider className="my-6" />
              <h2 className="text-xl font-semibold mb-4">Arguments</h2>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-green-800 mb-3">
                    Pro ({proArgs.length})
                  </h3>
                  <div className="flex flex-col gap-3">
                    {proArgs.map((arg) => (
                      <ArgumentCard
                        key={arg.uri}
                        arg={arg}
                        borderColor="#4caf50"
                        onClick={() => router.push(`/ballots/${id}/argument/${arg.uri.split('/').pop()}`)}
                      />
                    ))}
                    {proArgs.length === 0 && (
                      <p className="text-sm text-muted-foreground">No pro arguments yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-red-800 mb-3">
                    Contra ({contraArgs.length})
                  </h3>
                  <div className="flex flex-col gap-3">
                    {contraArgs.map((arg) => (
                      <ArgumentCard
                        key={arg.uri}
                        arg={arg}
                        borderColor="#ef5350"
                        onClick={() => router.push(`/ballots/${id}/argument/${arg.uri.split('/').pop()}`)}
                      />
                    ))}
                    {contraArgs.length === 0 && (
                      <p className="text-sm text-muted-foreground">No contra arguments yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {arguments_.length === 0 && !loading && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No arguments have been submitted for this ballot yet.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
