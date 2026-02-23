"use client";

import { useEffect, useState, useCallback, useRef, forwardRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../../lib/AuthContext';
import { getBallot, listArguments, listComments, createComment, createArgument } from '../../../lib/agent';
import { likeBallot, unlikeBallot, likeContent, unlikeContent } from '../../../lib/ballots';
import { formatDate, formatRelativeTime } from '../../../lib/utils';
import type { BallotWithMetadata, ArgumentWithMetadata, CommentWithMetadata } from '../../../types/ballots';

// ---------------------------------------------------------------------------
// Thread helpers
// ---------------------------------------------------------------------------

function buildThreadTree(comments: CommentWithMetadata[]): CommentWithMetadata[] {
  const map = new Map<string, CommentWithMetadata>();
  const roots: CommentWithMetadata[] = [];
  for (const c of comments) {
    map.set(c.uri, { ...c, replies: [] });
  }
  for (const c of comments) {
    const node = map.get(c.uri)!;
    if (c.parentUri && map.has(c.parentUri)) {
      map.get(c.parentUri)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

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
// Comment component
// ---------------------------------------------------------------------------

function CommentNode({
  comment,
  depth,
  onLikeToggle,
  onReply,
}: {
  comment: CommentWithMetadata;
  depth: number;
  onLikeToggle: (c: CommentWithMetadata) => void;
  onReply: (parentUri: string) => void;
}) {
  const indent = typeof window !== 'undefined' && window.innerWidth < 640 ? 16 : 24;
  const isExtern = comment.origin === 'extern';
  const liked = !!comment.viewer?.like;

  return (
    <div style={{ paddingLeft: depth > 0 ? indent : 0 }}>
      <div style={{
        display: 'flex',
        gap: 8,
        paddingTop: 10,
        paddingBottom: 6,
        borderLeft: depth > 0 ? '2px solid #e0e0e0' : 'none',
        paddingLeft: depth > 0 ? 10 : 0,
      }}>
        {isExtern
          ? <BskyAvatar size={28} />
          : <CantonAvatar canton={comment.author.canton} color={comment.author.color} size={28} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#8e8e8e' }}>
            <span style={{ fontWeight: 600, color: '#333' }}>
              {isExtern
                ? (comment.author.handle || comment.author.displayName || 'Bluesky')
                : (comment.author.displayName || 'Anonym')}
            </span>
            {isExtern && (
              <span style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 3,
                backgroundColor: '#e3f2fd',
                color: '#1185fe',
              }}>Bluesky</span>
            )}
            <span>{comment.record.createdAt ? formatRelativeTime(comment.record.createdAt) : ''}</span>
          </div>
          <div style={{ fontSize: 14, color: '#444', lineHeight: 1.5, marginTop: 2 }}>
            {comment.record.body}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 13, color: '#8e8e8e' }}>
            <button
              onClick={() => onLikeToggle(comment)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: liked ? '#d81b60' : '#8e8e8e', fontSize: 13,
              }}
            >
              {liked ? '\u2764' : '\u2661'} {(comment.likeCount ?? 0) > 0 ? comment.likeCount : ''}
            </button>
            {!isExtern && (
              <button
                onClick={() => onReply(comment.uri)}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  color: '#8e8e8e', fontSize: 13,
                }}
              >
                {'\ud83d\udcac'} Reply
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Nested replies — max visual depth 2 */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map((r) => (
            <CommentNode
              key={r.uri}
              comment={r}
              depth={Math.min(depth + 1, 2)}
              onLikeToggle={onLikeToggle}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Threaded comments section for an argument
// ---------------------------------------------------------------------------

function ArgumentComments({
  argumentUri,
  commentCount,
}: {
  argumentUri: string;
  commentCount: number;
}) {
  const [comments, setComments] = useState<CommentWithMetadata[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await listComments(argumentUri);
      setComments(data);
      setExpanded(true);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  }, [argumentUri, loading]);

  // Auto-load if there are comments
  useEffect(() => {
    if (commentCount > 0 && !comments && !loading) {
      loadComments();
    }
  }, [commentCount, comments, loading, loadComments]);

  const handleLikeToggle = useCallback(async (c: CommentWithMetadata) => {
    if (!comments) return;
    const liked = !!c.viewer?.like;

    setComments(prev => prev!.map(cm =>
      cm.uri === c.uri
        ? { ...cm, likeCount: (cm.likeCount ?? 0) + (liked ? -1 : 1), viewer: liked ? undefined : { like: '__pending__' } }
        : cm
    ));

    try {
      if (liked) {
        await unlikeContent(c.viewer!.like!);
        setComments(prev => prev!.map(cm =>
          cm.uri === c.uri ? { ...cm, viewer: undefined } : cm
        ));
      } else {
        const likeUri = await likeContent(c.uri, c.cid);
        setComments(prev => prev!.map(cm =>
          cm.uri === c.uri ? { ...cm, viewer: { like: likeUri } } : cm
        ));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      setComments(prev => prev!.map(cm =>
        cm.uri === c.uri
          ? { ...cm, likeCount: (cm.likeCount ?? 0) + (liked ? 1 : -1), viewer: liked ? { like: c.viewer!.like! } : undefined }
          : cm
      ));
    }
  }, [comments]);

  const handleReply = useCallback((parentUri: string) => {
    setReplyTarget(parentUri);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmitReply = useCallback(async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createComment(argumentUri, '', replyText.trim(), replyTarget ?? undefined);
      setReplyText('');
      setReplyTarget(null);
      const data = await listComments(argumentUri);
      setComments(data);
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmitting(false);
    }
  }, [argumentUri, replyText, replyTarget, submitting]);

  const handleTopLevelComment = useCallback(async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await createComment(argumentUri, '', replyText.trim());
      setReplyText('');
      setReplyTarget(null);
      const data = await listComments(argumentUri);
      setComments(data);
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmitting(false);
    }
  }, [argumentUri, replyText, submitting]);

  if (commentCount === 0 && !expanded) {
    return (
      <div style={{ padding: '8px 0 4px 0' }}>
        <ReplyInput
          ref={inputRef}
          value={replyText}
          onChange={setReplyText}
          onSubmit={handleTopLevelComment}
          submitting={submitting}
          placeholder="Write a comment..."
        />
      </div>
    );
  }

  if (loading && !comments) {
    return <div style={{ fontSize: 13, color: '#8e8e8e', padding: '8px 0' }}>Loading comments...</div>;
  }

  if (!comments) return null;

  const threaded = buildThreadTree(comments);
  const visibleRoots = expanded ? threaded : threaded.slice(0, 3);
  const hiddenCount = threaded.length - 3;

  return (
    <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 8, paddingTop: 4 }}>
      {visibleRoots.map((c) => {
        const previewReplies = expanded ? c.replies : (c.replies ?? []).slice(0, 1);
        const hiddenReplies = (c.replies ?? []).length - (previewReplies?.length ?? 0);
        return (
          <div key={c.uri}>
            <CommentNode comment={{ ...c, replies: previewReplies }} depth={0} onLikeToggle={handleLikeToggle} onReply={handleReply} />
            {!expanded && hiddenReplies > 0 && (
              <button
                onClick={() => setExpanded(true)}
                style={{ background: 'none', border: 'none', color: '#0085ff', fontSize: 13, cursor: 'pointer', padding: '4px 0 4px 34px' }}
              >
                Show {hiddenReplies} more {hiddenReplies === 1 ? 'reply' : 'replies'}...
              </button>
            )}
          </div>
        );
      })}
      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{ background: 'none', border: 'none', color: '#0085ff', fontSize: 13, cursor: 'pointer', padding: '4px 0' }}
        >
          Show {hiddenCount} more {hiddenCount === 1 ? 'comment' : 'comments'}...
        </button>
      )}

      {replyTarget && (
        <div style={{ fontSize: 12, color: '#8e8e8e', padding: '4px 0 0 0' }}>
          Replying to comment...{' '}
          <button
            onClick={() => setReplyTarget(null)}
            style={{ background: 'none', border: 'none', color: '#0085ff', fontSize: 12, cursor: 'pointer' }}
          >cancel</button>
        </div>
      )}
      <ReplyInput
        ref={inputRef}
        value={replyText}
        onChange={setReplyText}
        onSubmit={replyTarget ? handleSubmitReply : handleTopLevelComment}
        submitting={submitting}
        placeholder="Write a comment..."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reply input
// ---------------------------------------------------------------------------

const ReplyInput = forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  placeholder: string;
}>(function ReplyInput({ value, onChange, onSubmit, submitting, placeholder }, ref) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '6px 0' }}>
      <textarea
        ref={ref}
        rows={focused ? 3 : 1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { if (!value) setFocused(false); }}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: '8px 10px',
          fontSize: 13,
          border: '1px solid #ddd',
          borderRadius: 6,
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {(focused || value) && (
        <button
          onClick={onSubmit}
          disabled={!value.trim() || submitting}
          style={{
            padding: '8px 14px',
            fontSize: 13,
            backgroundColor: '#0085ff',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: value.trim() && !submitting ? 'pointer' : 'default',
            opacity: value.trim() && !submitting ? 1 : 0.5,
          }}
        >
          {submitting ? '...' : 'Send'}
        </button>
      )}
    </div>
  );
});

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

        {/* Type toggle */}
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
// Single argument card (used by virtualiser)
// ---------------------------------------------------------------------------

function ArgumentCard({
  arg,
  onLikeToggle,
}: {
  arg: ArgumentWithMetadata;
  onLikeToggle: (arg: ArgumentWithMetadata) => void;
}) {
  const isPro = arg.record.type === 'PRO';
  const accentColor = isPro ? '#4caf50' : '#ef5350';
  const liked = !!arg.viewer?.like;

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        borderLeft: `3px solid ${accentColor}`,
        marginBottom: 14,
        padding: '16px 18px',
      }}
    >
      {/* Author row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
      }}>
        <CantonAvatar canton={arg.author.canton} color={arg.author.color} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>
            {arg.author.displayName || 'Anonym'}
          </span>
          <span style={{ fontSize: 13, color: '#8e8e8e', marginLeft: 8 }}>
            {arg.record.createdAt ? formatRelativeTime(arg.record.createdAt) : ''}
          </span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
          backgroundColor: isPro ? '#e8f5e9' : '#ffebee',
          color: isPro ? '#2e7d32' : '#c62828',
        }}>
          {isPro ? 'Pro' : 'Contra'}
        </span>
      </div>

      {/* Content */}
      <h4 style={{ margin: '0 0 6px 0', fontSize: 16, color: '#333' }}>
        {arg.record.title}
      </h4>
      <p style={{ margin: '0 0 10px 0', fontSize: 14, color: '#555', lineHeight: 1.6 }}>
        {arg.record.body}
      </p>

      {/* Review badge */}
      {arg.reviewStatus === 'preliminary' && (
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 10,
          backgroundColor: '#fff3e0', color: '#e65100',
        }}>Preliminary</span>
      )}
      {arg.reviewStatus === 'approved' && (
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 10,
          backgroundColor: '#e8f5e9', color: '#2e7d32',
        }}>Peer-reviewed</span>
      )}
      {arg.reviewStatus === 'rejected' && (
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 10,
          backgroundColor: '#ffebee', color: '#c62828',
        }}>Rejected</span>
      )}

      {/* Action bar */}
      <div style={{
        display: 'flex', gap: 18, marginTop: 10, fontSize: 14, color: '#8e8e8e',
      }}>
        <button
          onClick={() => onLikeToggle(arg)}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: liked ? '#d81b60' : '#8e8e8e', fontSize: 14,
          }}
        >
          {liked ? '\u2764' : '\u2661'} {(arg.likeCount ?? 0) > 0 ? arg.likeCount : ''}
        </button>
        <span>
          {'\ud83d\udcac'} {(arg.commentCount ?? 0) > 0 ? arg.commentCount : ''}
        </span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(arg.uri);
          }}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: '#8e8e8e', fontSize: 14,
          }}
        >
          {'\u2197'} Share
        </button>
      </div>

      {/* Threaded comments */}
      <ArgumentComments
        argumentUri={arg.uri}
        commentCount={arg.commentCount ?? 0}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Virtualised argument feed
// ---------------------------------------------------------------------------

function VirtualArgumentFeed({
  arguments_,
  onArgLikeToggle,
}: {
  arguments_: ArgumentWithMetadata[];
  onArgLikeToggle: (arg: ArgumentWithMetadata) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: arguments_.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220,
    overscan: 5,
  });

  // Reset virtualizer when the list changes (filter/sort)
  useEffect(() => {
    virtualizer.measure();
  }, [arguments_, virtualizer]);

  return (
    <div
      ref={parentRef}
      style={{
        maxWidth: 640,
        margin: '0 auto',
        height: 'calc(100vh - 260px)',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={arguments_[virtualRow.index].uri}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ArgumentCard
              arg={arguments_[virtualRow.index]}
              onLikeToggle={onArgLikeToggle}
            />
          </div>
        ))}
      </div>
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
  const [arguments_, setArguments] = useState<ArgumentWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter & sort state
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState('random');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadData();
  }, [isAuthenticated, authLoading, router, id]);

  const loadData = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    setError('');

    try {
      const [ballotData, argsData] = await Promise.all([
        getBallot(id),
        listArguments(id, sortOrder, filterType),
      ]);
      setBallot(ballotData);
      setArguments(argsData);
    } catch (err) {
      console.error('Error loading ballot detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load ballot');
    } finally {
      setLoading(false);
    }
  }, [user, id, sortOrder, filterType]);

  // Re-fetch arguments when filter/sort changes
  useEffect(() => {
    if (!user || !id || authLoading || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const argsData = await listArguments(id, sortOrder, filterType);
        if (!cancelled) setArguments(argsData);
      } catch (err) {
        console.error('Error loading arguments:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [sortOrder, filterType, user, id, authLoading, isAuthenticated]);

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

  const handleArgLikeToggle = useCallback(async (arg: ArgumentWithMetadata) => {
    const liked = !!arg.viewer?.like;

    setArguments(prev => prev.map(a =>
      a.uri === arg.uri
        ? { ...a, likeCount: (a.likeCount ?? 0) + (liked ? -1 : 1), viewer: liked ? undefined : { like: '__pending__' } }
        : a
    ));

    try {
      if (liked) {
        await unlikeContent(arg.viewer!.like!);
        setArguments(prev => prev.map(a =>
          a.uri === arg.uri ? { ...a, viewer: undefined } : a
        ));
      } else {
        const likeUri = await likeContent(arg.uri, arg.cid);
        setArguments(prev => prev.map(a =>
          a.uri === arg.uri ? { ...a, viewer: { like: likeUri } } : a
        ));
      }
    } catch (err) {
      console.error('Failed to toggle arg like:', err);
      setArguments(prev => prev.map(a =>
        a.uri === arg.uri
          ? { ...a, likeCount: (a.likeCount ?? 0) + (liked ? 1 : -1), viewer: liked ? { like: arg.viewer!.like! } : undefined }
          : a
      ));
    }
  }, []);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        Restoring session...
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '20px',
    }}>
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

        {loading && (
          <div style={{
            textAlign: 'center', padding: 40, backgroundColor: 'white', borderRadius: 8,
          }}>
            <p>Loading ballot...</p>
          </div>
        )}

        {error && (
          <div style={{
            padding: 20, backgroundColor: '#ffebee', color: '#d32f2f',
            borderRadius: 8, marginBottom: 20, border: '1px solid #ffcdd2',
          }}>
            <strong>Error:</strong> {error}
            <button
              onClick={loadData}
              style={{
                marginLeft: 20, padding: '8px 16px', backgroundColor: '#d32f2f',
                color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && ballot && (
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

            {/* Filter & Sort Toolbar */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 10,
              backgroundColor: '#fff', borderRadius: 8, padding: '10px 16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, overflowX: 'auto',
            }}>
              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { label: 'Alle', value: undefined, color: '#333' },
                  { label: 'Pro', value: 'PRO' as const, color: '#2e7d32' },
                  { label: 'Contra', value: 'CONTRA' as const, color: '#c62828' },
                ]).map((tab) => (
                  <button
                    key={tab.label}
                    onClick={() => setFilterType(tab.value)}
                    style={{
                      padding: '6px 14px', fontSize: 14, fontWeight: 600,
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                      backgroundColor: filterType === tab.value ? '#f0f0f0' : 'transparent',
                      color: tab.color,
                      borderBottom: filterType === tab.value
                        ? `2px solid ${tab.color}`
                        : '2px solid transparent',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Sort dropdown */}
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={{
                    padding: '6px 10px', fontSize: 13, border: '1px solid #ddd',
                    borderRadius: 4, backgroundColor: '#fff', cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="random">Zufall</option>
                  <option value="top">Top</option>
                  <option value="new">Neu</option>
                  <option value="discussed">Diskutiert</option>
                </select>

                {/* Add argument button — hidden on mobile, shown via FAB */}
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    padding: '6px 14px', fontSize: 13, fontWeight: 600,
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
            </div>

            {/* Argument Feed (virtualised) */}
            {arguments_.length > 0 ? (
              <VirtualArgumentFeed
                arguments_={arguments_}
                onArgLikeToggle={handleArgLikeToggle}
              />
            ) : (
              !loading && (
                <div style={{
                  textAlign: 'center', padding: 40, backgroundColor: 'white',
                  borderRadius: 8, color: '#666', maxWidth: 640, margin: '0 auto',
                }}>
                  No arguments have been submitted for this ballot yet.
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Mobile FAB */}
      {!loading && ballot && (
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
            listArguments(id, sortOrder, filterType).then(setArguments).catch(console.error);
          }}
        />
      )}
    </div>
  );
}
