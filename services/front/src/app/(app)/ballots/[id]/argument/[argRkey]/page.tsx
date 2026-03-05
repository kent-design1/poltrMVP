"use client";

import { useEffect, useState, useCallback, useRef, forwardRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { listArguments, listComments, createComment } from '@/lib/agent';
import { likeContent, unlikeContent } from '@/lib/ballots';
import { formatRelativeTime } from '@/lib/utils';
import type { ArgumentWithMetadata, CommentWithMetadata } from '@/types/ballots';

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

function CantonAvatar({ canton, color, size = 28 }: { canton?: string; color?: string; size?: number }) {
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
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
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
// Comment node (recursive, clickable)
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
// Main page
// ---------------------------------------------------------------------------

export default function ArgumentDetailPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const ballotRkey = params.id as string;
  const argRkey = params.argRkey as string;

  const [argument, setArgument] = useState<ArgumentWithMetadata | null>(null);
  const [comments, setComments] = useState<CommentWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const replyInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) router.push('/');
  }, [isAuthenticated, authLoading, router]);

  const loadComments = useCallback(async (argUri: string) => {
    const allCmts = await listComments(argUri);
    const map = new Map<string, CommentWithMetadata>();
    for (const c of allCmts) map.set(c.uri, { ...c, replies: [] });
    for (const c of allCmts) {
      if (c.parentUri && map.has(c.parentUri)) {
        map.get(c.parentUri)!.replies!.push(map.get(c.uri)!);
      }
    }
    return allCmts.filter(c => !c.parentUri).map(c => map.get(c.uri)!);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || authLoading || !ballotRkey || !argRkey) return;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const args = await listArguments(ballotRkey);
        const arg = args.find(a => a.uri.split('/').pop() === argRkey);
        if (!arg) throw new Error('Argument not found');
        setArgument(arg);
        setComments(await loadComments(arg.uri));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load argument');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAuthenticated, authLoading, ballotRkey, argRkey, loadComments]);

  const handleLikeToggle = useCallback(async (c: CommentWithMetadata) => {
    const liked = !!c.viewer?.like;
    setComments(prev => prev.map(r =>
      r.uri === c.uri
        ? { ...r, likeCount: (r.likeCount ?? 0) + (liked ? -1 : 1), viewer: liked ? undefined : { like: '__pending__' } }
        : r
    ));
    try {
      if (liked) {
        await unlikeContent(c.viewer!.like!);
        setComments(prev => prev.map(r => r.uri === c.uri ? { ...r, viewer: undefined } : r));
      } else {
        const likeUri = await likeContent(c.uri, c.cid);
        setComments(prev => prev.map(r => r.uri === c.uri ? { ...r, viewer: { like: likeUri } } : r));
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      setComments(prev => prev.map(r =>
        r.uri === c.uri
          ? { ...r, likeCount: (r.likeCount ?? 0) + (liked ? 1 : -1), viewer: liked ? { like: c.viewer!.like! } : undefined }
          : r
      ));
    }
  }, []);

  const handleReply = useCallback(() => {
    replyInputRef.current?.focus();
  }, []);

  const handleNavigateToComment = useCallback((uri: string) => {
    router.push(`/feed/${ballotRkey}/comment?uri=${encodeURIComponent(uri)}`);
  }, [ballotRkey, router]);

  const handleSubmitComment = useCallback(async () => {
    if (!replyText.trim() || submitting || !argument) return;
    setSubmitting(true);
    try {
      await createComment(argument.uri, '', replyText.trim());
      setReplyText('');
      setComments(await loadComments(argument.uri));
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmitting(false);
    }
  }, [replyText, submitting, argument, loadComments]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Restoring session...
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const isPro = argument?.record.type === 'PRO';

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="max-w-2xl mx-auto">

        {/* Header nav */}
        <div className="mb-5">
          <button
            onClick={() => router.push(`/ballots/${ballotRkey}`)}
            className="px-5 py-2.5 text-sm bg-blue-500 text-white border-none rounded cursor-pointer"
          >
            &#8592; Back to Ballot
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="p-5 bg-red-50 text-red-700 rounded-lg mb-5 border border-red-200">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center p-10 bg-white rounded-lg text-gray-500">
            Loading argument...
          </div>
        )}

        {/* Content */}
        {!loading && argument && (
          <>
            {/* Argument card */}
            <div
              className="bg-white rounded-lg shadow-sm p-4 px-5 mb-4"
              style={{ borderLeft: `4px solid ${isPro ? '#4caf50' : '#ef5350'}` }}
            >
              <div className="flex items-start gap-2.5 mb-2.5">
                <h2 className="m-0 text-lg text-gray-900 flex-1 leading-snug">
                  {argument.record.title}
                </h2>
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap text-white"
                  style={{ backgroundColor: isPro ? '#16a34a' : '#dc2626' }}
                >
                  {isPro ? 'Pro' : 'Contra'}
                </span>
              </div>

              {argument.record.body && (
                <p className="m-0 mb-3 text-sm text-gray-700 leading-relaxed">
                  {argument.record.body}
                </p>
              )}

              <div className="flex gap-4 text-xs text-gray-400 items-center">
                {(argument.likeCount ?? 0) > 0 && <span>{'\u2661'} {argument.likeCount}</span>}
                {(argument.commentCount ?? 0) > 0 && (
                  <span>{'\ud83d\udcac'} {argument.commentCount}</span>
                )}
                {argument.reviewStatus === 'approved' && (
                  <span className="text-green-600 font-semibold">✅ Peer-reviewed</span>
                )}
                {argument.reviewStatus === 'preliminary' && (
                  <span className="text-orange-800">Preliminary</span>
                )}
              </div>
            </div>

            {/* Comments thread */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-2">
                Comments {comments.length > 0 ? `(${comments.length})` : ''}
              </div>

              {comments.length === 0 ? (
                <p className="text-gray-400 text-sm m-0">
                  No comments yet. Be the first!
                </p>
              ) : (
                comments.map((c) => (
                  <CommentNode
                    key={c.uri}
                    comment={c}
                    depth={0}
                    onLikeToggle={handleLikeToggle}
                    onReply={handleReply}
                    onNavigate={handleNavigateToComment}
                  />
                ))
              )}
            </div>

            {/* Comment input */}
            <div className="bg-white rounded-lg shadow-sm px-4 py-3">
              <div className="text-xs text-gray-600 mb-1.5">Add a comment:</div>
              <ReplyInput
                ref={replyInputRef}
                value={replyText}
                onChange={setReplyText}
                onSubmit={handleSubmitComment}
                submitting={submitting}
                placeholder="Write a comment..."
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
