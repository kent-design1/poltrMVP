"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { listBallots } from '@/lib/agent';
import { likeBallot, unlikeBallot } from '@/lib/ballots';
import { formatDate } from '@/lib/utils';
import type { BallotWithMetadata } from '@/types/ballots';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/spinner';
import { Separator } from '@/components/ui/separator';

export default function BallotSearch() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [ballots, setBallots] = useState<BallotWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
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
      <div className="flex items-center justify-center min-h-[50vh] gap-3">
        <Spinner />
        <span className="text-muted-foreground">Restoring session...</span>
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Swiss Ballot Entries</h1>

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-10 gap-3">
            <Spinner />
            <span className="text-muted-foreground">Loading ballots...</span>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span><strong>Error:</strong> {error}</span>
            <Button variant="destructive" size="sm" onClick={loadBallots}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && ballots.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-lg">No ballot entries found.</p>
          </CardContent>
        </Card>
      )}

      {!loading && ballots.length > 0 && (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {ballots.map((ballot) => {
            const rkey = ballot.uri.split('/').pop();
            return (
              <Card
                key={ballot.uri}
                className="cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => rkey && router.push(`/ballots/${rkey}`)}
              >
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg leading-tight">
                      {ballot.record.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {ballot.record.language && (
                        <Badge variant="secondary">{ballot.record.language}</Badge>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleLike(ballot);
                        }}
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
                    <p className="text-sm text-muted-foreground mb-3 leading-normal line-clamp-3">
                      {ballot.record.text}
                    </p>
                  )}

                  <Separator className="my-4" />

                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      <strong>Vote Date:</strong><br />
                      {formatDate(ballot.record.voteDate)}
                    </div>
                    {ballot.record.officialRef && (
                      <span className="text-xs text-muted-foreground">
                        Ref: (1) {ballot.record.officialRef}
                      </span>
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
            );
          })}
        </div>
      )}

      {!loading && ballots.length > 0 && (
        <p className="text-center text-muted-foreground">
          Found {ballots.length} ballot{ballots.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
