"use client";

import { useEffect, useState, useCallback, useRef, forwardRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getComment, listComments, createComment } from '@/lib/agent';
import { likeContent, unlikeContent } from '@/lib/ballots';
import { formatRelativeTime } from '@/lib/utils';
import type { CommentWithMetadata } from '@/types/ballots';

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
    <div className="flex gap-2 items-end py-1.5">
      <textarea
        ref={ref}
        rows={focused ? 3 : 1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { if (!value) setFocused(false); }}
        placeholder={placeholder}
        className="flex-1 px-2.5 py-2 text-xs border border-gray-300 rounded-md resize-none outline-none font-[inherit]"
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
          className="px-3.5 py-2 text-xs bg-blue-500 text-white border-none rounded-md"
          style={{
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
  onNavigate,
}: {
  comment: CommentWithMetadata;
  depth: number;
  onLikeToggle: (c: CommentWithMetadata) => void;
  onReply: (parentUri: string) => void;
  onNavigate: (uri: string) => void;
}) {
  const indent = typeof window !== 'undefined' && window.innerWidth < 640 ? 16 : 24;
  const isExtern = comment.origin === 'extern';
  const liked = !!comment.viewer?.like;

  return (
    <div style={{ paddingLeft: depth > 0 ? indent : 0 }}>
      <div
        onClick={() => onNavigate(comment.uri)}
        className="flex gap-2 pt-2.5 pb-1.5 cursor-pointer"
        style={{
          borderLeft: depth > 0 ? '2px solid #e0e0e0' : 'none',
          paddingLeft: depth > 0 ? 10 : 0,
        }}
      >
        {isExtern
          ? <BskyAvatar size={28} />
          : <CantonAvatar canton={comment.author.canton} color={comment.author.color} size={28} />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="font-semibold text-gray-700">
              {isExtern
                ? (comment.author.handle || comment.author.displayName || 'Bluesky')
                : (comment.author.displayName || 'Anonym')}
            </span>
            {isExtern && (
              <span className="text-[10px] px-1.5 py-px rounded bg-blue-50 text-blue-600">
                Bluesky
              </span>
            )}
            <span>{comment.record.createdAt ? formatRelativeTime(comment.record.createdAt) : ''}</span>
          </div>
          <div className="text-sm text-gray-700 leading-normal mt-0.5">
            {comment.record.body}
          </div>
          <div className="flex gap-3.5 mt-1 text-xs text-gray-400">
            <button
              onClick={(e) => { e.stopPropagation(); onLikeToggle(comment); }}
              className="bg-transparent border-none p-0 cursor-pointer text-xs"
              style={{ color: liked ? '#d81b60' : '#8e8e8e' }}
            >
              {liked ? '\u2764' : '\u2661'} {(comment.likeCount ?? 0) > 0 ? comment.likeCount : ''}
            </button>
            {!isExtern && (
              <button
                onClick={(e) => { e.stopPropagation(); onReply(comment.uri); }}
                className="bg-transparent border-none p-0 cursor-pointer text-xs text-gray-400"
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
              onNavigate={onNavigate}
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
    <div className="bg-gray-50 px-3 py-2 mb-4 rounded-r" style={{ borderLeft: '3px solid #4a90e2' }}>
      <div className="flex items-center gap-2">
        <span className="font-bold text-xs text-gray-700 flex-1">{title}</span>
        {type && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: isPro ? '#e8f5e9' : '#ffebee',
              color: isPro ? '#2e7d32' : '#c62828',
            }}
          >
            {isPro ? 'Pro' : 'Contra'}
          </span>
        )}
      </div>
      <div className="flex gap-3 mt-1 text-xs text-gray-400">
        {likeCount !== undefined && <span>{'\u2661'} {likeCount}</span>}
        {commentCount !== undefined && <span>{'\ud83d\udcac'} {commentCount}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact ancestor strip
// ---------------------------------------------------------------------------

function AncestorStrip({ comment, indent, onNavigate }: { comment: CommentWithMetadata; indent: number; onNavigate: (uri: string) => void }) {
  const isExtern = comment.origin === 'extern';
  const truncated = comment.record.body.length > 80
    ? comment.record.body.slice(0, 80) + '...'
    : comment.record.body;

  return (
    <div style={{ paddingLeft: indent, paddingTop: 6, paddingBottom: 6 }}>
      <div
        onClick={() => onNavigate(comment.uri)}
        className="flex items-center gap-1.5 bg-gray-100 rounded px-2 py-1 text-xs text-gray-500 cursor-pointer"
      >
        {isExtern
          ? <BskyAvatar size={20} />
          : <CantonAvatar canton={comment.author.canton} color={comment.author.color} size={20} />
        }
        <span className="font-semibold text-gray-600 whitespace-nowrap">
          {isExtern
            ? (comment.author.handle || comment.author.displayName || 'Bluesky')
            : (comment.author.displayName || 'Anonym')}:
        </span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">
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

  const handleNavigateToComment = useCallback((uri: string) => {
    router.push(`/feed/${id}/comment?uri=${encodeURIComponent(uri)}`);
  }, [id, router]);

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
      <div className="flex items-center justify-center min-h-screen">
        Restoring session...
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="max-w-2xl mx-auto">

        {/* Header nav */}
        <div className="mb-5">
          <button
            onClick={() => router.push(`/feed/${id}`)}
            className="px-5 py-2.5 text-sm bg-blue-500 text-white border-none rounded cursor-pointer"
          >
            &#8592; Back to Activity Feed
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-5 bg-red-50 text-red-700 rounded-lg mb-5 border border-red-200">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center p-10 bg-white rounded-lg text-gray-500">
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
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
                Thread
              </div>

              {/* Ancestor chain */}
              {ancestors.map((ancestor, idx) => (
                <AncestorStrip key={ancestor.uri} comment={ancestor} indent={idx * 16} onNavigate={handleNavigateToComment} />
              ))}

              {/* Focal comment */}
              <div style={{
                paddingLeft: ancestors.length * 16,
                paddingTop: ancestors.length > 0 ? 4 : 0,
              }}>
                <div className="bg-white rounded-r-lg shadow-md px-4 py-3" style={{ borderLeft: '3px solid #1565c0' }}>
                  {/* Focal author + timestamp */}
                  <div className="flex items-center gap-2 mb-2">
                    {focalComment.origin === 'extern'
                      ? <BskyAvatar size={32} />
                      : <CantonAvatar canton={focalComment.author.canton} color={focalComment.author.color} size={32} />
                    }
                    <div>
                      <div className="font-semibold text-sm text-gray-800">
                        {focalComment.origin === 'extern'
                          ? (focalComment.author.handle || focalComment.author.displayName || 'Bluesky')
                          : (focalComment.author.displayName || 'Anonym')}
                      </div>
                      <div className="text-xs text-gray-400">
                        {focalComment.record.createdAt ? formatRelativeTime(focalComment.record.createdAt) : ''}
                      </div>
                    </div>
                  </div>
                  {/* Focal comment text */}
                  <div className="text-sm text-gray-700 leading-relaxed mb-2.5">
                    {focalComment.record.body}
                  </div>
                  {/* Actions */}
                  <div className="flex gap-4 text-xs text-gray-400">
                    <button
                      onClick={() => handleLikeToggle(focalComment)}
                      className="bg-transparent border-none p-0 cursor-pointer text-xs"
                      style={{ color: focalComment.viewer?.like ? '#d81b60' : '#8e8e8e' }}
                    >
                      {focalComment.viewer?.like ? '\u2764' : '\u2661'}{' '}
                      {(focalComment.likeCount ?? 0) > 0 ? focalComment.likeCount : ''}
                    </button>
                    <button
                      onClick={handleReply}
                      className="bg-transparent border-none p-0 cursor-pointer text-xs text-blue-500 font-semibold"
                    >
                      {'\ud83d\udcac'} Reply
                    </button>
                  </div>
                </div>

                {/* Direct replies */}
                {directReplies.length > 0 && (
                  <div className="mt-2 pl-4">
                    {directReplies.map((reply) => (
                      <CommentNode
                        key={reply.uri}
                        comment={reply}
                        depth={0}
                        onLikeToggle={handleLikeToggle}
                        onReply={handleReply}
                        onNavigate={handleNavigateToComment}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Reply input */}
            <div className="bg-white rounded-lg shadow-sm px-4 py-3">
              <div className="text-xs text-gray-600 mb-1.5">
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
