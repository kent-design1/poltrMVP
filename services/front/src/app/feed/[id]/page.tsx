"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../lib/AuthContext';
import { getBallot, listActivity, markActivitySeen, createArgument } from '../../../lib/agent';
import { likeBallot, unlikeBallot } from '../../../lib/ballots';
import { formatDate, formatRelativeTime } from '../../../lib/utils';
import type { BallotWithMetadata, ActivityItem } from '../../../types/ballots';

// ---------------------------------------------------------------------------
// Canton avatar component
// ---------------------------------------------------------------------------

function CantonAvatar({ canton, color, size = 32 }: { canton?: string; color?: string; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      minWidth: size,
      borderRadius: 4,
      backgroundColor: color || '#90a4ae',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 700,
      fontSize: size * 0.4,
      lineHeight: 1,
    }}>
      {canton ? canton.toUpperCase() : '?'}
    </div>
  );
}

function BskyAvatar({ size = 28 }: { size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      minWidth: size,
      borderRadius: 4,
      backgroundColor: '#1185fe',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: size * 0.55,
      lineHeight: 1,
    }}>
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
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff', borderRadius: 12, padding: 24,
          width: '90%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Argument hinzuf&uuml;gen</h3>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['PRO', 'CONTRA'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setArgType(t)}
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 14,
                fontWeight: 600,
                border: '2px solid',
                borderColor: argType === t
                  ? (t === 'PRO' ? '#4caf50' : '#ef5350')
                  : '#ddd',
                borderRadius: 8,
                backgroundColor: argType === t
                  ? (t === 'PRO' ? '#e8f5e9' : '#ffebee')
                  : '#fff',
                color: t === 'PRO' ? '#2e7d32' : '#c62828',
                cursor: 'pointer',
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
          style={{
            width: '100%', padding: '10px 12px', fontSize: 14,
            border: '1px solid #ddd', borderRadius: 6, marginBottom: 12,
            boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
          }}
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Dein Argument..."
          rows={5}
          style={{
            width: '100%', padding: '10px 12px', fontSize: 14,
            border: '1px solid #ddd', borderRadius: 6, marginBottom: 12,
            boxSizing: 'border-box', resize: 'vertical', outline: 'none',
            fontFamily: 'inherit',
          }}
        />

        {error && (
          <div style={{ color: '#d32f2f', fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px', fontSize: 14, border: '1px solid #ddd',
              borderRadius: 6, backgroundColor: '#fff', cursor: 'pointer',
            }}
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !body.trim() || submitting}
            style={{
              padding: '10px 20px', fontSize: 14, border: 'none',
              borderRadius: 6, backgroundColor: '#0085ff', color: '#fff',
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
// Feed item shared helpers
// ---------------------------------------------------------------------------

interface ActivityCardProps {
  item: ActivityItem;
  onNavigate: (item: ActivityItem) => void;
}

// Left accent colors by type
const UNSEEN_ACCENT: Record<string, string> = {
  comment: '#1565c0',
  reply: '#1565c0',
  new_argument: '#0277bd',
  milestone: '#e65100',
};

function feedItemStyle(type: string, unseen: boolean): React.CSSProperties {
  return {
    padding: '14px 16px 12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #efefef',
    borderLeft: `3px solid ${unseen ? (UNSEEN_ACCENT[type] ?? '#1565c0') : 'transparent'}`,
    backgroundColor: unseen ? '#fdfdff' : '#fff',
  };
}

// Small blue dot shown inline in the header when unseen
function UnseenDot() {
  return (
    <span style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      backgroundColor: '#1565c0',
      flexShrink: 0,
      marginLeft: 4,
    }} />
  );
}

// Compact one-line argument reference: "on [Title] [PRO] [✓ voted]"
function ArgumentRef({
  title,
  type,
  voted,
}: {
  title: string;
  type?: 'PRO' | 'CONTRA';
  voted?: boolean;
}) {
  const isPro = type === 'PRO';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#aaa' }}>on</span>
      <span style={{
        fontSize: 12, fontWeight: 600, color: '#666',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260,
      }}>
        {title}
      </span>
      {type && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
          backgroundColor: isPro ? '#e8f5e9' : '#ffebee',
          color: isPro ? '#2e7d32' : '#c62828',
        }}>
          {isPro ? 'Pro' : 'Contra'}
        </span>
      )}
      {voted && (
        <span style={{ fontSize: 11, color: '#2e7d32', flexShrink: 0 }}>{'\u2713'} voted</span>
      )}
    </div>
  );
}

// Quoted parent comment — shows as a grayed left-border block
function ParentQuote({ displayName, text }: { displayName?: string; text: string }) {
  const truncated = text.length > 120 ? text.slice(0, 120) + '\u2026' : text;
  return (
    <div style={{
      borderLeft: '2px solid #d8d8d8',
      paddingLeft: 10,
      marginBottom: 8,
      fontSize: 13,
      color: '#999',
      lineHeight: 1.4,
    }}>
      {displayName && (
        <span style={{ fontWeight: 600, color: '#bbb' }}>{displayName}: </span>
      )}
      {truncated}
    </div>
  );
}

// The focal comment text — visually dominant
function FocalText({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 15, color: '#111', lineHeight: 1.55, wordBreak: 'break-word' }}>
      {text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentActivityCard
// ---------------------------------------------------------------------------

function CommentActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  const INDENT = 36; // avatar width (28) + gap (8)
  return (
    <div onClick={() => onNavigate(item)} style={feedItemStyle('comment', unseen)}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <CantonAvatar canton={item.actor.canton} color={item.actor.color} size={28} />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
          {item.actor.displayName || 'Anonym'}
        </span>
        <span style={{ fontSize: 13, color: '#999' }}>commented</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' }}>
          {formatRelativeTime(item.activityAt)}
        </span>
        {unseen && <UnseenDot />}
      </div>
      {/* Context + content, indented under avatar */}
      <div style={{ paddingLeft: INDENT }}>
        <ArgumentRef
          title={item.argument.title}
          type={item.argument.type}
          voted={!!item.viewer?.argumentLike}
        />
        {item.comment && <FocalText text={item.comment.text} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReplyActivityCard
// ---------------------------------------------------------------------------

function ReplyActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  const INDENT = 36;
  return (
    <div onClick={() => onNavigate(item)} style={feedItemStyle('reply', unseen)}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <CantonAvatar canton={item.actor.canton} color={item.actor.color} size={28} />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
          {item.actor.displayName || 'Anonym'}
        </span>
        <span style={{ fontSize: 13, color: '#999' }}>replied to</span>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#555' }}>
          {item.parent?.displayName || 'Anonym'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' }}>
          {formatRelativeTime(item.activityAt)}
        </span>
        {unseen && <UnseenDot />}
      </div>
      {/* Context + hierarchy, indented */}
      <div style={{ paddingLeft: INDENT }}>
        <ArgumentRef
          title={item.argument.title}
          type={item.argument.type}
          voted={!!item.viewer?.argumentLike}
        />
        {/* Parent comment as quoted context */}
        {item.parent && (
          <ParentQuote
            displayName={item.parent.displayName}
            text={item.parent.text}
          />
        )}
        {/* Focal reply — the new message */}
        {item.comment && <FocalText text={item.comment.text} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewArgumentActivityCard
// ---------------------------------------------------------------------------

function NewArgumentActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  const isPro = item.argument.type === 'PRO';
  const INDENT = 36;
  const preview = item.argument.body
    ? item.argument.body.slice(0, 160) + (item.argument.body.length > 160 ? '\u2026' : '')
    : '';

  return (
    <div onClick={() => onNavigate(item)} style={feedItemStyle('new_argument', unseen)}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <CantonAvatar canton={item.actor.canton} color={item.actor.color} size={28} />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
          {item.actor.displayName || 'Anonym'}
        </span>
        <span style={{ fontSize: 13, color: '#999' }}>posted a new argument</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' }}>
          {formatRelativeTime(item.activityAt)}
        </span>
        {unseen && <UnseenDot />}
      </div>
      {/* Argument content */}
      <div style={{ paddingLeft: INDENT }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: preview ? 6 : 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111', flex: 1, lineHeight: 1.4 }}>
            {item.argument.title}
          </span>
          {item.argument.type && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
              flexShrink: 0, whiteSpace: 'nowrap', marginTop: 2,
              backgroundColor: isPro ? '#e8f5e9' : '#ffebee',
              color: isPro ? '#2e7d32' : '#c62828',
            }}>
              {isPro ? 'Pro' : 'Contra'}
            </span>
          )}
        </div>
        {preview && (
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.5, marginBottom: 8 }}>
            {preview}
          </div>
        )}
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#bbb' }}>
          {(item.argument.likeCount ?? 0) > 0 && (
            <span>{'\u2661'} {item.argument.likeCount}</span>
          )}
          {(item.argument.commentCount ?? 0) > 0 && (
            <span>{'\ud83d\udcac'} {item.argument.commentCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MilestoneActivityCard
// ---------------------------------------------------------------------------

function MilestoneActivityCard({ item, onNavigate }: ActivityCardProps) {
  const unseen = !item.viewer?.seen;
  const isPro = item.argument.type === 'PRO';
  const INDENT = 28; // emoji (20) + gap (8)

  return (
    <div onClick={() => onNavigate(item)} style={feedItemStyle('milestone', unseen)}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{'\u2705'}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>Argument approved</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' }}>
          {formatRelativeTime(item.activityAt)}
        </span>
        {unseen && <UnseenDot />}
      </div>
      {/* Argument title */}
      <div style={{ paddingLeft: INDENT }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#333', flex: 1, lineHeight: 1.4 }}>
            {item.argument.title}
          </span>
          {item.argument.type && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
              flexShrink: 0, whiteSpace: 'nowrap', marginTop: 2,
              backgroundColor: isPro ? '#e8f5e9' : '#ffebee',
              color: isPro ? '#2e7d32' : '#c62828',
            }}>
              {isPro ? 'Pro' : 'Contra'}
            </span>
          )}
        </div>
        {!!item.viewer?.argumentLike && (
          <span style={{ fontSize: 11, color: '#2e7d32', marginTop: 4, display: 'block' }}>
            {'\u2713'} voted
          </span>
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
    <div style={{
      backgroundColor: '#fff',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1px solid #efefef',
    }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header nav */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => router.push('/ballots')}
              style={{
                padding: '10px 20px', fontSize: 14, backgroundColor: '#0085ff',
                color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              &#8592; Back to Ballots
            </button>
            <button
              onClick={() => router.push(`/ballots/${id}`)}
              style={{
                padding: '10px 20px', fontSize: 14, backgroundColor: '#546e7a',
                color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              Classic View
            </button>
            <button
              onClick={() => router.push('/review')}
              style={{
                padding: '10px 20px', fontSize: 14, backgroundColor: '#7c4dff',
                color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              Peer Review
            </button>
          </div>
        </div>

        {/* Ballot loading / error */}
        {ballotLoading && (
          <div style={{ textAlign: 'center', padding: 40, backgroundColor: 'white', borderRadius: 8 }}>
            <p>Loading ballot...</p>
          </div>
        )}

        {ballotError && (
          <div style={{
            padding: 20, backgroundColor: '#ffebee', color: '#d32f2f',
            borderRadius: 8, marginBottom: 20, border: '1px solid #ffcdd2',
          }}>
            <strong>Error:</strong> {ballotError}
            <button
              onClick={loadBallot}
              style={{
                marginLeft: 20, padding: '8px 16px', backgroundColor: '#d32f2f',
                color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!ballotLoading && ballot && (
          <>
            {/* Ballot card */}
            <div style={{
              backgroundColor: 'white', padding: 24, borderRadius: 8,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: 20,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16,
              }}>
                <h1 style={{ margin: 0, color: '#333', fontSize: 24 }}>
                  {ballot.record.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ballot.record.language && (
                    <span style={{
                      fontSize: 12, padding: '4px 8px', backgroundColor: '#e3f2fd',
                      borderRadius: 4, color: '#1976d2',
                    }}>
                      {ballot.record.language}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleLike}
                    title={ballot.viewer?.like ? 'Unlike' : 'Like'}
                    style={{
                      background: 'none', border: '1px solid transparent',
                      padding: '2px 4px', fontSize: 20, cursor: 'pointer',
                      color: ballot.viewer?.like ? '#d81b60' : '#b0bec5',
                      transition: 'color 0.2s',
                    }}
                  >
                    {ballot.viewer?.like ? '\u2764' : '\u2661'}
                    {(ballot.likeCount ?? 0) > 0 && (
                      <span style={{ fontSize: 12, marginLeft: 4 }}>{ballot.likeCount}</span>
                    )}
                  </button>
                </div>
              </div>

              {ballot.record.topic && (
                <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
                  <strong>Topic:</strong> {ballot.record.topic}
                </div>
              )}

              {ballot.record.text && (
                <p style={{ fontSize: 15, color: '#555', lineHeight: 1.6, marginBottom: 16 }}>
                  {ballot.record.text}
                </p>
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 16, paddingTop: 16, borderTop: '1px solid #eee',
              }}>
                <div style={{ fontSize: 14, color: '#666' }}>
                  <strong>Vote Date:</strong> {formatDate(ballot.record.voteDate)}
                </div>
                {ballot.record.officialRef && (
                  <div style={{ fontSize: 12, color: '#999' }}>
                    Ref: {ballot.record.officialRef}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 13, color: '#666' }}>
                {(ballot.argumentCount ?? 0) > 0 && (
                  <span>{ballot.argumentCount} argument{ballot.argumentCount !== 1 ? 's' : ''}</span>
                )}
                {(ballot.commentCount ?? 0) > 0 && (
                  <span>{ballot.commentCount} comment{ballot.commentCount !== 1 ? 's' : ''}</span>
                )}
              </div>
            </div>

            {/* Activity toolbar */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 10,
              backgroundColor: '#fff', borderRadius: 8, padding: '10px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12,
            }}>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as 'all' | 'comments' | 'arguments')}
                style={{
                  padding: '8px 12px', fontSize: 14, fontWeight: 600,
                  border: '1px solid #ddd', borderRadius: 6,
                  backgroundColor: '#fff', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="all">All Activity</option>
                <option value="arguments">Arguments</option>
                <option value="comments">Comments</option>
              </select>

              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  backgroundColor: '#0085ff', color: '#fff', border: 'none',
                  borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'none',
                }}
                className="desktop-add-btn"
              >
                + Argument
              </button>
              <style>{`.desktop-add-btn { display: inline-block !important; } @media (max-width: 639px) { .desktop-add-btn { display: none !important; } }`}</style>
            </div>

            {/* Activity error */}
            {activityError && (
              <div style={{
                padding: 16, backgroundColor: '#ffebee', color: '#d32f2f',
                borderRadius: 8, marginBottom: 16, border: '1px solid #ffcdd2',
              }}>
                {activityError}
              </div>
            )}

            {/* Activity feed */}
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              {activityLoading ? (
                <div style={{
                  textAlign: 'center', padding: 40, backgroundColor: '#fff',
                  borderRadius: 8, color: '#666', border: '1px solid #efefef',
                }}>
                  Loading activity...
                </div>
              ) : activities.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: 40, backgroundColor: '#fff',
                  borderRadius: 8, color: '#666', border: '1px solid #efefef',
                }}>
                  {emptyMessage[filter]}
                </div>
              ) : (
                <>
                  <ActivityFeed
                    activities={activities}
                    onNavigate={handleCardClick}
                  />
                  {hasMore && (
                    <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
                      <button
                        onClick={() => loadActivities(filter, false)}
                        disabled={loadingMore}
                        style={{
                          padding: '10px 24px', fontSize: 14,
                          border: '1px solid #ddd', borderRadius: 6,
                          backgroundColor: '#fff', cursor: loadingMore ? 'default' : 'pointer',
                          color: '#333', opacity: loadingMore ? 0.6 : 1,
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
          style={{
            position: 'fixed', bottom: 24, right: 24, width: 56, height: 56,
            borderRadius: '50%', backgroundColor: '#0085ff', color: '#fff',
            border: 'none', fontSize: 28, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 20,
            display: 'none',
          }}
          className="mobile-fab"
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
