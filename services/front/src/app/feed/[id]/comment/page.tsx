"use client";

import { useEffect, useState, useCallback, useRef, forwardRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../lib/AuthContext';
import { getComment, listComments, createComment } from '../../../../lib/agent';
import { likeContent, unlikeContent } from '../../../../lib/ballots';
import { formatRelativeTime } from '../../../../lib/utils';
import type { CommentWithMetadata } from '../../../../types/ballots';

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

function buildAncestorChain(
  commentMap: Map<string, CommentWithMetadata>,
  focalUri: string,
): CommentWithMetadata[] {
  const chain: CommentWithMetadata[] = [];
  let current = commentMap.get(focalUri);
  while (current?.parentUri) {
    const parent = commentMap.get(current.parentUri);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

// ---------------------------------------------------------------------------
// Canton avatar
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
// Comment node (full rendering with threading)
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
// Argument context box
// ---------------------------------------------------------------------------

function ArgumentContextBox({
  title,
  type,
  likeCount,
  commentCount,
}: {
  title: string;
  type?: 'PRO' | 'CONTRA';
  likeCount?: number;
  commentCount?: number;
}) {
  const isPro = type === 'PRO';
  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      borderLeft: '3px solid #4a90e2',
      padding: '8px 12px',
      margin: '0 0 16px 0',
      borderRadius: '0 4px 4px 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#333', flex: 1 }}>{title}</span>
        {type && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            backgroundColor: isPro ? '#e8f5e9' : '#ffebee',
            color: isPro ? '#2e7d32' : '#c62828',
          }}>
            {isPro ? 'Pro' : 'Contra'}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: '#8e8e8e' }}>
        {likeCount !== undefined && <span>{'\u2661'} {likeCount}</span>}
        {commentCount !== undefined && <span>{'\ud83d\udcac'} {commentCount}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact ancestor strip
// ---------------------------------------------------------------------------

function AncestorStrip({ comment, indent }: { comment: CommentWithMetadata; indent: number }) {
  const isExtern = comment.origin === 'extern';
  const truncated = comment.record.body.length > 80
    ? comment.record.body.slice(0, 80) + '...'
    : comment.record.body;

  return (
    <div style={{
      paddingLeft: indent,
      paddingTop: 6,
      paddingBottom: 6,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f0f0f0',
        borderRadius: 4,
        padding: '4px 8px',
        fontSize: 13,
        color: '#666',
      }}>
        {isExtern
          ? <BskyAvatar size={20} />
          : <CantonAvatar canton={comment.author.canton} color={comment.author.color} size={20} />
        }
        <span style={{ fontWeight: 600, color: '#555', whiteSpace: 'nowrap' }}>
          {isExtern
            ? (comment.author.handle || comment.author.displayName || 'Bluesky')
            : (comment.author.displayName || 'Anonym')}:
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {truncated}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Argument info type
// ---------------------------------------------------------------------------

type ArgumentInfo = {
  uri: string;
  rkey: string;
  title: string;
  body?: string;
  type?: 'PRO' | 'CONTRA';
  likeCount?: number;
  commentCount?: number;
  reviewStatus?: string;
  ballotRkey: string;
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CommentDetailPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const commentUri = searchParams.get('uri') ?? '';

  const [focalComment, setFocalComment] = useState<CommentWithMetadata | null>(null);
  const [argument, setArgument] = useState<ArgumentInfo | null>(null);
  const [directReplies, setDirectReplies] = useState<CommentWithMetadata[]>([]);
  const [ancestors, setAncestors] = useState<CommentWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  // Auth guard
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, authLoading, router]);

  // Load data
  useEffect(() => {
    if (!isAuthenticated || authLoading || !commentUri) return;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const { comment, argument: arg } = await getComment(commentUri);
        const allCmts = await listComments(arg.uri);

        // Build comment map (includes focal comment in case it's not in allCmts)
        const commentMap = new Map<string, CommentWithMetadata>();
        for (const c of allCmts) {
          commentMap.set(c.uri, { ...c, replies: [] });
        }
        if (!commentMap.has(comment.uri)) {
          commentMap.set(comment.uri, { ...comment, replies: [] });
        }

        // Populate replies
        for (const c of allCmts) {
          if (c.parentUri && commentMap.has(c.parentUri)) {
            commentMap.get(c.parentUri)!.replies!.push(commentMap.get(c.uri)!);
          }
        }

        // Build ancestors
        const chain = buildAncestorChain(commentMap, comment.uri);

        // Direct replies with their full sub-trees
        const replies = allCmts
          .filter(c => c.parentUri === comment.uri)
          .map(c => commentMap.get(c.uri)!);

        setFocalComment(comment);
        setArgument(arg);
        setAncestors(chain);
        setDirectReplies(replies);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comment');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, authLoading, commentUri]);

  const handleLikeToggle = useCallback(async (c: CommentWithMetadata) => {
    const liked = !!c.viewer?.like;

    if (c.uri === focalComment?.uri) {
      setFocalComment(prev => prev ? {
        ...prev,
        likeCount: (prev.likeCount ?? 0) + (liked ? -1 : 1),
        viewer: liked ? undefined : { like: '__pending__' },
      } : prev);
    } else {
      setDirectReplies(prev => prev.map(r =>
        r.uri === c.uri
          ? { ...r, likeCount: (r.likeCount ?? 0) + (liked ? -1 : 1), viewer: liked ? undefined : { like: '__pending__' } }
          : r
      ));
    }

    try {
      if (liked) {
        await unlikeContent(c.viewer!.like!);
        if (c.uri === focalComment?.uri) {
          setFocalComment(prev => prev ? { ...prev, viewer: undefined } : prev);
        } else {
          setDirectReplies(prev => prev.map(r => r.uri === c.uri ? { ...r, viewer: undefined } : r));
        }
      } else {
        const likeUri = await likeContent(c.uri, c.cid);
        if (c.uri === focalComment?.uri) {
          setFocalComment(prev => prev ? { ...prev, viewer: { like: likeUri } } : prev);
        } else {
          setDirectReplies(prev => prev.map(r => r.uri === c.uri ? { ...r, viewer: { like: likeUri } } : r));
        }
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      if (c.uri === focalComment?.uri) {
        setFocalComment(prev => prev ? {
          ...prev,
          likeCount: (prev.likeCount ?? 0) + (liked ? 1 : -1),
          viewer: liked ? { like: c.viewer!.like! } : undefined,
        } : prev);
      } else {
        setDirectReplies(prev => prev.map(r =>
          r.uri === c.uri
            ? { ...r, likeCount: (r.likeCount ?? 0) + (liked ? 1 : -1), viewer: liked ? { like: c.viewer!.like! } : undefined }
            : r
        ));
      }
    }
  }, [focalComment]);

  const handleReply = useCallback(() => {
    replyInputRef.current?.focus();
  }, []);

  const handleSubmitReply = useCallback(async () => {
    if (!replyText.trim() || submitting || !focalComment || !argument) return;
    setSubmitting(true);
    try {
      await createComment(argument.uri, '', replyText.trim(), focalComment.uri);
      setReplyText('');
      // Reload replies
      const allCmts = await listComments(argument.uri);
      const commentMap = new Map<string, CommentWithMetadata>();
      for (const c of allCmts) {
        commentMap.set(c.uri, { ...c, replies: [] });
      }
      for (const c of allCmts) {
        if (c.parentUri && commentMap.has(c.parentUri)) {
          commentMap.get(c.parentUri)!.replies!.push(commentMap.get(c.uri)!);
        }
      }
      const replies = allCmts
        .filter(c => c.parentUri === focalComment.uri)
        .map(c => commentMap.get(c.uri)!);
      setDirectReplies(replies);
    } catch (err) {
      console.error('Failed to submit reply:', err);
    } finally {
      setSubmitting(false);
    }
  }, [replyText, submitting, focalComment, argument]);

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        Restoring session...
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header nav */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => router.push(`/feed/${id}`)}
            style={{
              padding: '10px 20px', fontSize: 14, backgroundColor: '#0085ff',
              color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer',
            }}
          >
            &#8592; Back to Activity Feed
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            padding: 20, backgroundColor: '#ffebee', color: '#d32f2f',
            borderRadius: 8, marginBottom: 20, border: '1px solid #ffcdd2',
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{
            textAlign: 'center', padding: 40, backgroundColor: 'white',
            borderRadius: 8, color: '#666',
          }}>
            Loading comment...
          </div>
        )}

        {/* Content */}
        {!loading && focalComment && argument && (
          <>
            {/* Argument context */}
            <ArgumentContextBox
              title={argument.title}
              type={argument.type}
              likeCount={argument.likeCount}
              commentCount={argument.commentCount}
            />

            {/* Thread section */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              padding: '16px',
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#8e8e8e',
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
                borderBottom: '1px solid #f0f0f0', paddingBottom: 8,
              }}>
                Thread
              </div>

              {/* Ancestor chain */}
              {ancestors.map((ancestor, idx) => (
                <AncestorStrip key={ancestor.uri} comment={ancestor} indent={idx * 16} />
              ))}

              {/* Focal comment */}
              <div style={{
                paddingLeft: ancestors.length * 16,
                paddingTop: ancestors.length > 0 ? 4 : 0,
              }}>
                <div style={{
                  backgroundColor: '#fff',
                  borderLeft: '3px solid #1565c0',
                  borderRadius: '0 8px 8px 0',
                  boxShadow: '0 2px 8px rgba(21,101,192,0.12)',
                  padding: '12px 16px',
                }}>
                  {/* Focal author + timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {focalComment.origin === 'extern'
                      ? <BskyAvatar size={32} />
                      : <CantonAvatar canton={focalComment.author.canton} color={focalComment.author.color} size={32} />
                    }
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#222' }}>
                        {focalComment.origin === 'extern'
                          ? (focalComment.author.handle || focalComment.author.displayName || 'Bluesky')
                          : (focalComment.author.displayName || 'Anonym')}
                      </div>
                      <div style={{ fontSize: 12, color: '#8e8e8e' }}>
                        {focalComment.record.createdAt ? formatRelativeTime(focalComment.record.createdAt) : ''}
                      </div>
                    </div>
                  </div>
                  {/* Focal comment text */}
                  <div style={{ fontSize: 15, color: '#333', lineHeight: 1.6, marginBottom: 10 }}>
                    {focalComment.record.body}
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#8e8e8e' }}>
                    <button
                      onClick={() => handleLikeToggle(focalComment)}
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        color: focalComment.viewer?.like ? '#d81b60' : '#8e8e8e', fontSize: 13,
                      }}
                    >
                      {focalComment.viewer?.like ? '\u2764' : '\u2661'}{' '}
                      {(focalComment.likeCount ?? 0) > 0 ? focalComment.likeCount : ''}
                    </button>
                    <button
                      onClick={handleReply}
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        color: '#0085ff', fontSize: 13, fontWeight: 600,
                      }}
                    >
                      {'\ud83d\udcac'} Reply
                    </button>
                  </div>
                </div>

                {/* Direct replies */}
                {directReplies.length > 0 && (
                  <div style={{ marginTop: 8, paddingLeft: 16 }}>
                    {directReplies.map((reply) => (
                      <CommentNode
                        key={reply.uri}
                        comment={reply}
                        depth={0}
                        onLikeToggle={handleLikeToggle}
                        onReply={handleReply}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reply input */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              padding: '12px 16px',
            }}>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>
                Reply to this comment:
              </div>
              <ReplyInput
                ref={replyInputRef}
                value={replyText}
                onChange={setReplyText}
                onSubmit={handleSubmitReply}
                submitting={submitting}
                placeholder="Write a reply..."
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
