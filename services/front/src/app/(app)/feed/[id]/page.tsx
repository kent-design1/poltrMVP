"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getBallot, listActivity, markActivitySeen, createArgument } from '@/lib/agent';
import { likeBallot, unlikeBallot } from '@/lib/ballots';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import type { BallotWithMetadata, ActivityItem } from '@/types/ballots';

// ---------------------------------------------------------------------------
// Canton avatar component
// ---------------------------------------------------------------------------

function CantonAvatar({ canton, color, size = 32 }: { canton?: string; color?: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center text-white font-bold leading-none"
      style={{
        width: size, height: size, minWidth: size,
        borderRadius: 4, backgroundColor: color || '#90a4ae',
        fontSize: size * 0.4,
      }}
    >
      {canton ? canton.toUpperCase() : '?'}
    </div>
  );
}

function BskyAvatar({ size = 28 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center text-white leading-none"
      style={{
        width: size, height: size, minWidth: size,
        borderRadius: 4, backgroundColor: '#1185fe',
        fontSize: size * 0.55,
      }}
    >
      {'\ud83e\udd8b'}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Argument Modal
// ---------------------------------------------------------------------------

function AddArgumentModal({
  ballotUri,
  onClose,
  onCreated,
}: {
  ballotUri: string;
  onClose: () => void;
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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create argument');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center z-[1000]"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl p-6 w-[90%] max-w-lg max-h-[90vh] overflow-auto"
      >
        <h3 className="m-0 mb-4 text-lg">Argument hinzuf&uuml;gen</h3>

        <div className="flex gap-2 mb-4">
          {(['PRO', 'CONTRA'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setArgType(t)}
              className="flex-1 py-2.5 text-sm font-semibold border-2 rounded-lg cursor-pointer"
              style={{
                borderColor: argType === t
                  ? (t === 'PRO' ? '#4caf50' : '#ef5350')
                  : '#ddd',
                backgroundColor: argType === t
                  ? (t === 'PRO' ? '#e8f5e9' : '#ffebee')
                  : '#fff',
                color: t === 'PRO' ? '#2e7d32' : '#c62828',
              }}
            >
              {t === 'PRO' ? 'Pro' : 'Contra'}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titel"
          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-md mb-3 box-border outline-none font-[inherit]"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Dein Argument..."
          rows={5}
          className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-md mb-3 box-border resize-y outline-none font-[inherit]"
        />

        {error && (
          <div className="text-red-700 text-xs mb-3">{error}</div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm border border-gray-300 rounded-md bg-white cursor-pointer"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !body.trim() || submitting}
            className="px-5 py-2.5 text-sm border-none rounded-md bg-blue-500 text-white"
            style={{
              cursor: title.trim() && body.trim() && !submitting ? 'pointer' : 'default',
              opacity: title.trim() && body.trim() && !submitting ? 1 : 0.5,
            }}
          >
            {submitting ? 'Erstellen...' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feed layout helpers
// ---------------------------------------------------------------------------

interface ActivityCardProps {
  item: ActivityItem;
  onNavigate: (item: ActivityItem) => void;
}

// Context avatar — smaller (36px), lighter color; used for parent posts in thread
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

// Focal avatar — larger (40px), uses profile color; used for the new/main post
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

// Argument header bar — shown at top of comment/reply/milestone entries
function ArgumentHeader({ title, type, approved }: { title: string; type?: 'PRO' | 'CONTRA'; approved?: boolean }) {
  const isPro = type === 'PRO';
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
      {approved && <span className="text-sm leading-none shrink-0">✅</span>}
      <span
        className="text-xs font-semibold flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
        style={{ color: type === 'PRO' ? '#166534' : type === 'CONTRA' ? '#991b1b' : '#374151' }}
      >
        {title}
      </span>
      {type && (
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 text-white"
          style={{ backgroundColor: isPro ? '#16a34a' : '#dc2626' }}
        >
          {isPro ? 'Pro' : 'Contra'}
        </span>
      )}
    </div>
  );
}

// Skipped ancestors indicator — dotted vertical line + ellipsis, between ArgumentHeader and context
function ThreadSkippedRow() {
  return (
    <div className="bg-white px-4 py-1 flex gap-3">
      <div className="w-10 shrink-0 flex flex-col items-center">
        <div className="flex-1 ml-px" style={{ borderLeft: '2px dashed #d1d5db' }} />
      </div>
      <div className="text-xs text-gray-400 self-center py-0.5">
        &middot;&middot;&middot;
      </div>
    </div>
  );
}

// Thread context row — parent post, de-emphasized, with continuous vertical line
function ThreadContextRow({ displayName, text }: { displayName?: string; text: string }) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex gap-3">
      {/* Avatar column: line fills full height, avatar on top */}
      <div className="w-10 shrink-0 relative flex flex-col items-center">
        <div
          className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2"
          style={{ width: 2, backgroundColor: '#d1d5db' }}
        />
        <ContextAvatar displayName={displayName} />
      </div>
      {/* Content — lighter weight and color than focal */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-600 mb-0.5">
          {displayName || 'Anonym'}
        </div>
        <div className="text-sm text-gray-600 leading-snug break-words">
          {text}
        </div>
      </div>
    </div>
  );
}

// Focal row — the new/current post, visually dominant, with blue left border
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
    <div className="bg-white px-4 py-3 flex gap-3" style={{ borderLeft: '4px solid #3b82f6' }}>
      {/* No thread line on focal — it's the end of the chain */}
      <FocalAvatar canton={actor.canton} color={actor.color} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: replyTo ? 4 : 6 }}>
          {/* Bold name + dark color — stronger than context */}
          <span className="font-bold text-sm text-gray-900">
            {actor.displayName || 'Anonym'}
          </span>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(timestamp)}
          </span>
          {unseen && (
            <span
              className="inline-block rounded-full shrink-0 bg-blue-500"
              style={{ width: 7, height: 7 }}
            />
          )}
        </div>
        {/* "Replying to" line in blue — visually links to context above */}
        {replyTo && (
          <div className="text-xs text-blue-600 mb-1.5 font-medium">
            Replying to {replyTo}
          </div>
        )}
        {/* Focal text — darker and larger than context text */}
        <div className="text-sm text-gray-900 leading-relaxed break-words">
          {text}
        </div>
      </div>
    </div>
  );
}

// Action bar — like/comment counts at the bottom of each entry
function ActionBar({ likeCount, commentCount, argumentLike }: {
  likeCount?: number;
  commentCount?: number;
  argumentLike?: string;
}) {
  return (
    <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center gap-5">
      <span className="text-xs text-gray-500">
        {'\ud83d\udcac'} {commentCount ?? 0}
      </span>
      <span className="text-xs" style={{ color: argumentLike ? '#dc2626' : '#6b7280' }}>
        {argumentLike ? '\u2764' : '\u2661'} {likeCount ?? 0}
      </span>
      {argumentLike && (
        <span className="text-xs text-green-800 font-semibold">
          {'\u2713'} voted
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentActivityCard — new top-level comment on an argument
// ---------------------------------------------------------------------------

function CommentActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  return (
    <div
      onClick={() => onNavigate(item)}
      className="cursor-pointer rounded-lg border border-gray-200 overflow-hidden mb-4"
    >
      <ArgumentHeader title={item.argument.title} type={item.argument.type} />
      <FocalRow
        actor={item.actor}
        text={item.comment?.text ?? ''}
        timestamp={item.activityAt}
        unseen={unseen}
      />
      <ActionBar
        likeCount={item.argument.likeCount}
        commentCount={item.argument.commentCount}
        argumentLike={item.viewer?.argumentLike}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReplyActivityCard — reply in a thread (shows parent context above focal)
// ---------------------------------------------------------------------------

function ReplyActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  return (
    <div
      onClick={() => onNavigate(item)}
      className="cursor-pointer rounded-lg border border-gray-200 overflow-hidden mb-4"
    >
      <ArgumentHeader title={item.argument.title} type={item.argument.type} />
      {/* Skipped ancestors: dotted line when thread is deeper than parent→reply */}
      {item.parent?.hasParent && <ThreadSkippedRow />}
      {/* Thread context: parent post with vertical line connecting down to focal */}
      {item.parent && (
        <ThreadContextRow
          displayName={item.parent.displayName}
          text={item.parent.text}
        />
      )}
      {/* Focal: the reply itself — emphasized */}
      <FocalRow
        actor={item.actor}
        text={item.comment?.text ?? ''}
        timestamp={item.activityAt}
        replyTo={item.parent?.displayName}
        unseen={unseen}
      />
      <ActionBar
        likeCount={item.argument.likeCount}
        commentCount={item.argument.commentCount}
        argumentLike={item.viewer?.argumentLike}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewArgumentActivityCard — new argument posted (argument IS the focal content)
// ---------------------------------------------------------------------------

function NewArgumentActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  const isPro = item.argument.type === 'PRO';
  const preview = item.argument.body
    ? item.argument.body.slice(0, 200) + (item.argument.body.length > 200 ? '\u2026' : '')
    : '';

  return (
    <div
      onClick={() => onNavigate(item)}
      className="cursor-pointer rounded-lg border border-gray-200 overflow-hidden mb-4"
    >
      {/* No ArgumentHeader — the argument itself is the focal content */}
      <div className="bg-white px-4 py-3 flex gap-3" style={{ borderLeft: '4px solid #3b82f6' }}>
        <FocalAvatar canton={item.actor.canton} color={item.actor.color} />
        <div className="flex-1 min-w-0">
          {/* Author + timestamp header */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-bold text-sm text-gray-900">
              {item.actor.displayName || 'Anonym'}
            </span>
            <span className="text-xs text-gray-400">
              {formatRelativeTime(item.activityAt)}
            </span>
            {unseen && (
              <span
                className="inline-block rounded-full shrink-0"
                style={{ width: 7, height: 7, backgroundColor: '#0277bd' }}
              />
            )}
          </div>
          {/* Argument title + PRO/CONTRA badge */}
          <div className="flex items-start gap-2" style={{ marginBottom: preview ? 8 : 0 }}>
            <span className="font-bold text-sm text-gray-900 flex-1 leading-snug">
              {item.argument.title}
            </span>
            {item.argument.type && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap text-white"
                style={{ backgroundColor: isPro ? '#16a34a' : '#dc2626' }}
              >
                {isPro ? 'Pro' : 'Contra'}
              </span>
            )}
          </div>
          {preview && (
            <div className="text-sm text-gray-600 leading-normal">
              {preview}
            </div>
          )}
        </div>
      </div>
      <ActionBar
        likeCount={item.argument.likeCount}
        commentCount={item.argument.commentCount}
        argumentLike={item.viewer?.argumentLike}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MilestoneActivityCard — argument approved by community
// ---------------------------------------------------------------------------

function MilestoneActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  return (
    <div
      onClick={() => onNavigate(item)}
      className="cursor-pointer rounded-lg border border-gray-200 overflow-hidden mb-4"
    >
      <ArgumentHeader title={item.argument.title} type={item.argument.type} approved />
      <div className="bg-white px-4 py-2.5 flex items-center gap-3">
        {/* Spacer to align content with focal rows above */}
        <div className="w-10 shrink-0" />
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs font-semibold text-green-800">
            {'\ud83c\udf89'} Community approved
          </span>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
          {formatRelativeTime(item.activityAt)}
        </span>
        {unseen && (
          <span
            className="inline-block rounded-full shrink-0"
            style={{ width: 7, height: 7, backgroundColor: '#e65100' }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

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
// Main page component
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

  // Load on mount and filter change
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
      <div className="flex items-center justify-center min-h-screen">
        Restoring session...
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  const filterLabel: Record<string, string> = {
    all: 'All Activity',
    comments: 'Comments',
    arguments: 'Arguments',
  };

  const emptyMessage: Record<string, string> = {
    all: 'No activity yet for this ballot.',
    comments: 'No comment activity yet.',
    arguments: 'No argument activity yet.',
  };

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="max-w-3xl mx-auto">
        {/* Header nav */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/ballots')}
              className="px-5 py-2.5 text-sm bg-blue-500 text-white border-none rounded cursor-pointer"
            >
              &#8592; Back to Ballots
            </button>
            <button
              onClick={() => router.push(`/ballots/${id}`)}
              className="px-5 py-2.5 text-sm text-white border-none rounded cursor-pointer"
              style={{ backgroundColor: '#546e7a' }}
            >
              Classic View
            </button>
            <button
              onClick={() => router.push('/review')}
              className="px-5 py-2.5 text-sm bg-violet-500 text-white border-none rounded cursor-pointer"
            >
              Peer Review
            </button>
          </div>
        </div>

        {/* Ballot loading / error */}
        {ballotLoading && (
          <div className="text-center p-10 bg-white rounded-lg">
            <p>Loading ballot...</p>
          </div>
        )}

        {ballotError && (
          <div className="p-5 bg-red-50 text-red-700 rounded-lg mb-5 border border-red-200">
            <strong>Error:</strong> {ballotError}
            <button
              onClick={loadBallot}
              className="ml-5 px-4 py-2 bg-red-700 text-white border-none rounded cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {!ballotLoading && ballot && (
          <>
            {/* Ballot card */}
            <div className="bg-white p-6 rounded-lg shadow mb-5">
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
                      <span className="text-xs ml-1">{ballot.likeCount}</span>
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

            {/* Activity toolbar */}
            <div className="sticky top-0 z-10 bg-white rounded-lg px-4 py-2.5 shadow-sm mb-4 flex items-center justify-between gap-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'comments' | 'arguments')}
                className="px-3 py-2 text-sm font-semibold border border-gray-300 rounded-md bg-white cursor-pointer outline-none"
              >
                <option value="all">All Activity</option>
                <option value="arguments">Arguments</option>
                <option value="comments">Comments</option>
              </select>

              <button
                onClick={() => setShowAddModal(true)}
                className="desktop-add-btn px-4 py-2 text-xs font-semibold bg-blue-500 text-white border-none rounded-md cursor-pointer whitespace-nowrap"
                style={{ display: 'none' }}
              >
                + Argument
              </button>
              <style>{`.desktop-add-btn { display: inline-block !important; } @media (max-width: 639px) { .desktop-add-btn { display: none !important; } }`}</style>
            </div>

            {/* Activity error */}
            {activityError && (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-4 border border-red-200">
                {activityError}
              </div>
            )}

            {/* Activity feed */}
            <div className="max-w-xl mx-auto">
              {activityLoading ? (
                <div className="text-center p-10 bg-white rounded-lg text-gray-500 border border-gray-100">
                  Loading activity...
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center p-10 bg-white rounded-lg text-gray-500 border border-gray-100">
                  {emptyMessage[filter]}
                </div>
              ) : (
                <>
                  <ActivityFeed
                    activities={activities}
                    onNavigate={handleCardClick}
                  />
                  {hasMore && (
                    <div className="text-center py-2 pb-4">
                      <button
                        onClick={() => loadActivities(filter, false)}
                        disabled={loadingMore}
                        className="px-6 py-2.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700"
                        style={{
                          cursor: loadingMore ? 'default' : 'pointer',
                          opacity: loadingMore ? 0.6 : 1,
                        }}
                      >
                        {loadingMore ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile FAB */}
      {!ballotLoading && ballot && (
        <button
          onClick={() => setShowAddModal(true)}
          className="mobile-fab fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-500 text-white border-none text-3xl cursor-pointer shadow-lg z-20"
          style={{ display: 'none' }}
        >
          +
        </button>
      )}
      <style>{`@media (max-width: 639px) { .mobile-fab { display: flex !important; align-items: center; justify-content: center; } }`}</style>

      {/* Add argument modal */}
      {showAddModal && ballot && (
        <AddArgumentModal
          ballotUri={ballot.uri}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            loadActivities(filter, true);
          }}
        />
      )}
    </div>
  );
}
