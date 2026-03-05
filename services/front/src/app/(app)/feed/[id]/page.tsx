"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getBallot, listActivity, markActivitySeen, createArgument } from '@/lib/agent';
import { likeBallot, unlikeBallot } from '@/lib/ballots';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import type { BallotWithMetadata, ActivityItem } from '@/types/ballots';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/spinner';
import { ProContraBadge } from '@/components/pro-contra-badge';
import { FullWidthDivider } from '@/components/full-width-divider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Add Argument Modal (using Dialog)
// ---------------------------------------------------------------------------

function AddArgumentModal({
  ballotUri,
  open,
  onOpenChange,
  onCreated,
}: {
  ballotUri: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [argType, setArgType] = useState<'PRO' | 'CONTRA'>('PRO');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await createArgument(ballotUri, title.trim(), body.trim(), argType);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create argument');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Argument hinzuf&uuml;gen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            {(['PRO', 'CONTRA'] as const).map((t) => {
              const selected = argType === t;
              const isPro = t === 'PRO';
              return (
                <Button
                  key={t}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  className={`flex-1 ${selected ? (isPro ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700') : ''}`}
                  onClick={() => setArgType(t)}
                >
                  {isPro ? 'Pro' : 'Contra'}
                </Button>
              );
            })}
          </div>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel"
          />

          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Dein Argument..."
            rows={5}
          />

          {error && (
            <p className="text-destructive text-xs">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !body.trim() || submitting}
          >
            {submitting ? 'Erstellen...' : 'Erstellen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Feed layout helpers
// ---------------------------------------------------------------------------

interface ActivityCardProps {
  item: ActivityItem;
  onNavigate: (item: ActivityItem) => void;
}

function ContextAvatar({ displayName }: { displayName?: string }) {
  const initial = (displayName || '?')[0].toUpperCase();
  return (
    <div
      className="relative z-[1] flex items-center justify-center rounded-full shrink-0"
      style={{
        width: 36, height: 36,
        backgroundColor: '#93c5fd',
        color: '#1e3a8a', fontWeight: 600, fontSize: 12,
      }}
    >
      {initial}
    </div>
  );
}

function FocalAvatar({ canton, color }: { canton?: string; color?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-full shrink-0 text-white font-bold"
      style={{
        width: 40, height: 40,
        backgroundColor: color || '#f472b6',
        fontSize: 13,
      }}
    >
      {canton ? canton.toUpperCase().slice(0, 2) : '?'}
    </div>
  );
}

function ArgumentHeader({ title, type, approved }: { title: string; type?: 'PRO' | 'CONTRA'; approved?: boolean }) {
  const isPro = type === 'PRO';
  return (
    <div className="bg-card border-b px-4 py-2 flex items-center gap-2">
      {approved && <span className="text-sm leading-none shrink-0">&#9989;</span>}
      <span
        className="text-xs font-semibold flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ color: type === 'PRO' ? '#166534' : type === 'CONTRA' ? '#991b1b' : undefined }}
      >
        {title}
      </span>
      {type && <ProContraBadge type={isPro ? 'pro' : 'contra'} />}
    </div>
  );
}

function ThreadSkippedRow() {
  return (
    <div className="bg-card px-4 py-1 flex gap-3">
      <div className="w-10 shrink-0 flex flex-col items-center">
        <div className="flex-1 ml-px" style={{ borderLeft: '2px dashed #d1d5db' }} />
      </div>
      <div className="text-xs text-muted-foreground self-center py-0.5">
        &middot;&middot;&middot;
      </div>
    </div>
  );
}

function ThreadContextRow({ displayName, text }: { displayName?: string; text: string }) {
  return (
    <div className="bg-card border-b px-4 py-2.5 flex gap-3">
      <div className="w-10 shrink-0 relative flex flex-col items-center">
        <div
          className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2"
          style={{ width: 2, backgroundColor: '#d1d5db' }}
        />
        <ContextAvatar displayName={displayName} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-muted-foreground mb-0.5">
          {displayName || 'Anonym'}
        </div>
        <div className="text-sm text-muted-foreground leading-snug break-words">
          {text}
        </div>
      </div>
    </div>
  );
}

function FocalRow({
  actor,
  text,
  timestamp,
  replyTo,
  unseen,
}: {
  actor: ActivityItem['actor'];
  text: string;
  timestamp: string;
  replyTo?: string;
  unseen?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-3 flex gap-3" style={{ borderLeft: '4px solid #3b82f6' }}>
      <FocalAvatar canton={actor.canton} color={actor.color} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: replyTo ? 4 : 6 }}>
          <span className="font-bold text-sm">{actor.displayName || 'Anonym'}</span>
          <span className="text-xs text-muted-foreground">{formatRelativeTime(timestamp)}</span>
          {unseen && (
            <span className="inline-block rounded-full shrink-0 bg-blue-500" style={{ width: 7, height: 7 }} />
          )}
        </div>
        {replyTo && (
          <div className="text-xs text-blue-600 mb-1.5 font-medium">
            Replying to {replyTo}
          </div>
        )}
        <div className="text-sm leading-relaxed break-words">{text}</div>
      </div>
    </div>
  );
}

function ActionBar({ likeCount, commentCount, argumentLike }: {
  likeCount?: number;
  commentCount?: number;
  argumentLike?: string;
}) {
  return (
    <div className="bg-card border-t px-4 py-2 flex items-center gap-5">
      <span className="text-xs text-muted-foreground">
        {'\ud83d\udcac'} {commentCount ?? 0}
      </span>
      <span className="text-xs" style={{ color: argumentLike ? '#dc2626' : '#6b7280' }}>
        {argumentLike ? '\u2764' : '\u2661'} {likeCount ?? 0}
      </span>
      {argumentLike && (
        <span className="text-xs text-green-800 font-semibold">{'\u2713'} voted</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity cards
// ---------------------------------------------------------------------------

function CommentActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  return (
    <div
      onClick={() => onNavigate(item)}
      className="cursor-pointer rounded-lg border overflow-hidden mb-4"
    >
      <ArgumentHeader title={item.argument.title} type={item.argument.type} />
      <FocalRow actor={item.actor} text={item.comment?.text ?? ''} timestamp={item.activityAt} unseen={unseen} />
      <ActionBar likeCount={item.argument.likeCount} commentCount={item.argument.commentCount} argumentLike={item.viewer?.argumentLike} />
    </div>
  );
}

function ReplyActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  return (
    <div
      onClick={() => onNavigate(item)}
      className="cursor-pointer rounded-lg border overflow-hidden mb-4"
    >
      <ArgumentHeader title={item.argument.title} type={item.argument.type} />
      {item.parent?.hasParent && <ThreadSkippedRow />}
      {item.parent && <ThreadContextRow displayName={item.parent.displayName} text={item.parent.text} />}
      <FocalRow actor={item.actor} text={item.comment?.text ?? ''} timestamp={item.activityAt} replyTo={item.parent?.displayName} unseen={unseen} />
      <ActionBar likeCount={item.argument.likeCount} commentCount={item.argument.commentCount} argumentLike={item.viewer?.argumentLike} />
    </div>
  );
}

function NewArgumentActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  const isPro = item.argument.type === 'PRO';
  const preview = item.argument.body
    ? item.argument.body.slice(0, 200) + (item.argument.body.length > 200 ? '\u2026' : '')
    : '';

  return (
    <div
      onClick={() => onNavigate(item)}
      className="cursor-pointer rounded-lg border overflow-hidden mb-4"
    >
      <div className="bg-card px-4 py-3 flex gap-3" style={{ borderLeft: '4px solid #3b82f6' }}>
        <FocalAvatar canton={item.actor.canton} color={item.actor.color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-bold text-sm">{item.actor.displayName || 'Anonym'}</span>
            <span className="text-xs text-muted-foreground">{formatRelativeTime(item.activityAt)}</span>
            {unseen && (
              <span className="inline-block rounded-full shrink-0" style={{ width: 7, height: 7, backgroundColor: '#0277bd' }} />
            )}
          </div>
          <div className="flex items-start gap-2" style={{ marginBottom: preview ? 8 : 0 }}>
            <span className="font-bold text-sm flex-1 leading-snug">{item.argument.title}</span>
            {item.argument.type && <ProContraBadge type={isPro ? 'pro' : 'contra'} />}
          </div>
          {preview && (
            <div className="text-sm text-muted-foreground leading-normal">{preview}</div>
          )}
        </div>
      </div>
      <ActionBar likeCount={item.argument.likeCount} commentCount={item.argument.commentCount} argumentLike={item.viewer?.argumentLike} />
    </div>
  );
}

function MilestoneActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  return (
    <div
      onClick={() => onNavigate(item)}
      className="cursor-pointer rounded-lg border overflow-hidden mb-4"
    >
      <ArgumentHeader title={item.argument.title} type={item.argument.type} approved />
      <div className="bg-card px-4 py-2.5 flex items-center gap-3">
        <div className="w-10 shrink-0" />
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs font-semibold text-green-800">
            {'\ud83c\udf89'} Community approved
          </span>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {formatRelativeTime(item.activityAt)}
        </span>
        {unseen && (
          <span className="inline-block rounded-full shrink-0" style={{ width: 7, height: 7, backgroundColor: '#e65100' }} />
        )}
      </div>
    </div>
  );
}

function ActivityFeed({
  activities,
  onNavigate,
}: {
  activities: ActivityItem[];
  onNavigate: (item: ActivityItem) => void;
}) {
  if (activities.length === 0) return null;

  return (
    <div>
      {activities.map((item) => {
        const props: ActivityCardProps = { item, onNavigate };
        switch (item.type) {
          case 'comment':
            return <CommentActivityCard key={item.activityUri} {...props} />;
          case 'reply':
            return <ReplyActivityCard key={item.activityUri} {...props} />;
          case 'new_argument':
            return <NewArgumentActivityCard key={item.activityUri} {...props} />;
          case 'milestone':
            return <MilestoneActivityCard key={item.activityUri} {...props} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BallotFeed() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [ballot, setBallot] = useState<BallotWithMetadata | null>(null);
  const [ballotLoading, setBallotLoading] = useState(true);
  const [ballotError, setBallotError] = useState('');

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [cursor, setCursor] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filter, setFilter] = useState<'all' | 'comments' | 'arguments'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadBallot();
  }, [isAuthenticated, authLoading, router, id]);

  const loadBallot = useCallback(async () => {
    if (!id) return;
    setBallotLoading(true);
    setBallotError('');
    try {
      const ballotData = await getBallot(id);
      setBallot(ballotData);
    } catch (err) {
      setBallotError(err instanceof Error ? err.message : 'Failed to load ballot');
    } finally {
      setBallotLoading(false);
    }
  }, [id]);

  const loadActivities = useCallback(async (selectedFilter: 'all' | 'comments' | 'arguments', reset = true) => {
    if (!id) return;
    if (reset) {
      setActivityLoading(true);
      setActivityError('');
    } else {
      setLoadingMore(true);
    }

    try {
      const currentCursor = reset ? undefined : cursor;
      const result = await listActivity(id, selectedFilter, currentCursor);
      if (reset) {
        setActivities(result.activities);
      } else {
        setActivities(prev => [...prev, ...result.activities]);
      }
      setCursor(result.cursor ?? undefined);
      setHasMore(!!result.cursor);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setActivityLoading(false);
      setLoadingMore(false);
    }
  }, [id, cursor]);

  useEffect(() => {
    if (!isAuthenticated || authLoading || !id) return;
    setCursor(undefined);
    loadActivities(filter, true);
  }, [filter, isAuthenticated, authLoading, id]);

  const handleCardClick = useCallback((item: ActivityItem) => {
    markActivitySeen([item.activityUri]).catch(console.error);
    setActivities(acts => acts.map(a =>
      a.activityUri === item.activityUri ? { ...a, viewer: { ...a.viewer, seen: true } } : a
    ));
    if (item.type === 'comment' || item.type === 'reply') {
      router.push(`/feed/${id}/comment?uri=${encodeURIComponent(item.comment!.uri)}`);
    } else {
      router.push(`/ballots/${id}`);
    }
  }, [id, router]);

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

  const emptyMessage: Record<string, string> = {
    all: 'No activity yet for this ballot.',
    comments: 'No comment activity yet.',
    arguments: 'No argument activity yet.',
  };

  return (
    <div className="space-y-5">
      {/* Header nav */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push('/ballots')}>
          &larr; Back to Ballots
        </Button>
        <Button variant="secondary" size="sm" onClick={() => router.push(`/ballots/${id}`)}>
          Classic View
        </Button>
        <Button variant="secondary" size="sm" onClick={() => router.push('/review')}>
          Peer Review
        </Button>
      </div>

      {/* Ballot loading / error */}
      {ballotLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-10 gap-3">
            <Spinner />
            <span className="text-muted-foreground">Loading ballot...</span>
          </CardContent>
        </Card>
      )}

      {ballotError && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span><strong>Error:</strong> {ballotError}</span>
            <Button variant="destructive" size="sm" onClick={loadBallot}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {!ballotLoading && ballot && (
        <>
          {/* Ballot card */}
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

          <FullWidthDivider className="my-5" />

          {/* Activity toolbar */}
          <div className="sticky top-14 z-10 bg-card rounded-lg px-4 py-2.5 shadow-sm flex items-center justify-between gap-3 border">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activity</SelectItem>
                <SelectItem value="arguments">Arguments</SelectItem>
                <SelectItem value="comments">Comments</SelectItem>
              </SelectContent>
            </Select>

            <Button size="sm" className="hidden sm:inline-flex" onClick={() => setShowAddModal(true)}>
              + Argument
            </Button>
          </div>

          {/* Activity error */}
          {activityError && (
            <Alert variant="destructive">
              <AlertDescription>{activityError}</AlertDescription>
            </Alert>
          )}

          {/* Activity feed */}
          <div className="max-w-xl mx-auto">
            {activityLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-10 gap-3">
                  <Spinner />
                  <span className="text-muted-foreground">Loading activity...</span>
                </CardContent>
              </Card>
            ) : activities.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  {emptyMessage[filter]}
                </CardContent>
              </Card>
            ) : (
              <>
                <ActivityFeed activities={activities} onNavigate={handleCardClick} />
                {hasMore && (
                  <div className="text-center py-2 pb-4">
                    <Button
                      variant="outline"
                      onClick={() => loadActivities(filter, false)}
                      disabled={loadingMore}
                    >
                      {loadingMore ? 'Loading...' : 'Load More'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Mobile FAB */}
      {!ballotLoading && ballot && (
        <Button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full text-3xl shadow-lg z-20 sm:hidden"
          size="icon"
        >
          +
        </Button>
      )}

      {/* Add argument dialog */}
      {ballot && (
        <AddArgumentModal
          ballotUri={ballot.uri}
          open={showAddModal}
          onOpenChange={setShowAddModal}
          onCreated={() => loadActivities(filter, true)}
        />
      )}
    </div>
  );
}
