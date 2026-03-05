"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getPendingReviews, getReviewCriteria, submitReview } from '@/lib/agent';
import type { ReviewInvitation, ReviewCriterion, ReviewCriterionRating } from '@/types/ballots';

interface ReviewFormState {
  criteria: ReviewCriterionRating[];
  vote: 'APPROVE' | 'REJECT' | null;
  justification: string;
}

export default function ReviewDashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [invitations, setInvitations] = useState<ReviewInvitation[]>([]);
  const [criteriaTemplate, setCriteriaTemplate] = useState<ReviewCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formStates, setFormStates] = useState<Record<string, ReviewFormState>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadData();
  }, [isAuthenticated, authLoading, router]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [invs, crit] = await Promise.all([
        getPendingReviews(),
        getReviewCriteria(),
      ]);
      setInvitations(invs);
      setCriteriaTemplate(crit);

      // Initialize form states
      const states: Record<string, ReviewFormState> = {};
      for (const inv of invs) {
        states[inv.argumentUri] = {
          criteria: crit.map(c => ({ ...c, rating: 3 })),
          vote: null,
          justification: '',
        };
      }
      setFormStates(states);
    } catch (err) {
      console.error('Error loading reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const updateCriterionRating = (argumentUri: string, key: string, rating: number) => {
    setFormStates(prev => ({
      ...prev,
      [argumentUri]: {
        ...prev[argumentUri],
        criteria: prev[argumentUri].criteria.map(c =>
          c.key === key ? { ...c, rating } : c
        ),
      },
    }));
  };

  const updateVote = (argumentUri: string, vote: 'APPROVE' | 'REJECT') => {
    setFormStates(prev => ({
      ...prev,
      [argumentUri]: { ...prev[argumentUri], vote },
    }));
  };

  const updateJustification = (argumentUri: string, justification: string) => {
    setFormStates(prev => ({
      ...prev,
      [argumentUri]: { ...prev[argumentUri], justification },
    }));
  };

  const handleSubmit = async (argumentUri: string) => {
    const form = formStates[argumentUri];
    if (!form || !form.vote) return;

    if (form.vote === 'REJECT' && !form.justification.trim()) {
      setError('Justification is required for rejection.');
      return;
    }

    setSubmitting(argumentUri);
    setError('');
    try {
      await submitReview(
        argumentUri,
        form.criteria,
        form.vote,
        form.justification || undefined,
      );
      setSubmitResult(prev => ({
        ...prev,
        [argumentUri]: 'Review submitted. The result will appear once enough reviews are collected.',
      }));
      // Remove from list
      setInvitations(prev => prev.filter(inv => inv.argumentUri !== argumentUri));
    } catch (err) {
      console.error('Submit failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setSubmitting(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Restoring session...
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-5">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="m-0 text-gray-700">Peer Review</h1>
          <button
            onClick={() => router.push('/ballots')}
            className="px-5 py-2.5 text-sm bg-blue-500 text-white border-none rounded cursor-pointer"
          >
            Back to Ballots
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 text-red-700 rounded-lg mb-5 border border-red-200">
            {error}
          </div>
        )}

        {Object.entries(submitResult).map(([uri, msg]) => (
          <div key={uri} className="px-4 py-3 bg-green-50 text-green-800 rounded-lg mb-3 border border-green-200">
            {msg}
          </div>
        ))}

        {loading && (
          <div className="text-center p-10 bg-white rounded-lg">
            <p>Loading pending reviews...</p>
          </div>
        )}

        {!loading && invitations.length === 0 && (
          <div className="text-center p-10 bg-white rounded-lg text-gray-500">
            No pending reviews. Check back later.
          </div>
        )}

        {!loading && invitations.map((inv) => {
          const form = formStates[inv.argumentUri];
          if (!form) return null;
          const isSubmitting = submitting === inv.argumentUri;

          return (
            <div key={inv.argumentUri} className="bg-white p-6 rounded-lg shadow mb-5">
              {/* Argument preview */}
              <div
                className="p-4 bg-gray-50 rounded-md mb-5"
                style={{ borderLeft: `4px solid ${inv.argument.type === 'PRO' ? '#4caf50' : '#ef5350'}` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      backgroundColor: inv.argument.type === 'PRO' ? '#e8f5e9' : '#ffebee',
                      color: inv.argument.type === 'PRO' ? '#2e7d32' : '#c62828',
                    }}
                  >
                    {inv.argument.type}
                  </span>
                  <span className="text-xs text-gray-400">
                    Ballot: {inv.argument.ballotRkey}
                  </span>
                </div>
                <h3 className="m-0 mb-2 text-gray-700 text-base">
                  {inv.argument.title}
                </h3>
                <p className="m-0 text-sm text-gray-600 leading-relaxed">
                  {inv.argument.body}
                </p>
              </div>

              {/* Criteria sliders */}
              <div className="mb-5">
                <h4 className="m-0 mb-3 text-gray-700 text-sm">
                  Criteria Assessment
                </h4>
                {form.criteria.map((criterion) => (
                  <div key={criterion.key} className="mb-3">
                    <div className="flex justify-between mb-1">
                      <label className="text-xs text-gray-600">{criterion.label}</label>
                      <span className="text-xs text-gray-700 font-semibold">{criterion.rating}/5</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={criterion.rating}
                      onChange={(e) => updateCriterionRating(inv.argumentUri, criterion.key, parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              {/* Vote toggle */}
              <div className="mb-4">
                <h4 className="m-0 mb-2 text-gray-700 text-sm">Decision</h4>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => updateVote(inv.argumentUri, 'APPROVE')}
                    className="flex-1 p-2.5 border-2 rounded-md cursor-pointer font-semibold"
                    style={{
                      borderColor: form.vote === 'APPROVE' ? '#4caf50' : '#ddd',
                      backgroundColor: form.vote === 'APPROVE' ? '#e8f5e9' : 'white',
                      color: form.vote === 'APPROVE' ? '#2e7d32' : '#666',
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVote(inv.argumentUri, 'REJECT')}
                    className="flex-1 p-2.5 border-2 rounded-md cursor-pointer font-semibold"
                    style={{
                      borderColor: form.vote === 'REJECT' ? '#ef5350' : '#ddd',
                      backgroundColor: form.vote === 'REJECT' ? '#ffebee' : 'white',
                      color: form.vote === 'REJECT' ? '#c62828' : '#666',
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>

              {/* Justification */}
              <div className="mb-4">
                <label className="block text-xs text-gray-600 mb-1">
                  Justification {form.vote === 'REJECT' ? '(required)' : '(optional)'}
                </label>
                <textarea
                  value={form.justification}
                  onChange={(e) => updateJustification(inv.argumentUri, e.target.value)}
                  placeholder="Explain your decision..."
                  rows={3}
                  className="w-full p-2.5 border border-gray-300 rounded-md text-sm resize-y box-border"
                />
              </div>

              {/* Submit */}
              <button
                type="button"
                onClick={() => handleSubmit(inv.argumentUri)}
                disabled={!form.vote || isSubmitting}
                className="w-full py-3 text-sm font-semibold text-white border-none rounded-md"
                style={{
                  backgroundColor: form.vote ? '#0085ff' : '#ccc',
                  cursor: form.vote ? 'pointer' : 'not-allowed',
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
