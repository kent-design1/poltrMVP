"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getPendingReviews, getReviewCriteria, submitReview } from '@/lib/agent';
import type { ReviewInvitation, ReviewCriterion, ReviewCriterionRating } from '@/types/ballots';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/spinner';
import { ProContraBadge } from '@/components/pro-contra-badge';

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
      <div className="flex items-center justify-center min-h-[50vh] gap-3">
        <Spinner />
        <span className="text-muted-foreground">Restoring session...</span>
      </div>
    );
  }
  if (!isAuthenticated || !user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Peer Review</h1>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {Object.entries(submitResult).map(([uri, msg]) => (
        <Alert key={uri}>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      ))}

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-10 gap-3">
            <Spinner />
            <span className="text-muted-foreground">Loading pending reviews...</span>
          </CardContent>
        </Card>
      )}

      {!loading && invitations.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No pending reviews. Check back later.
          </CardContent>
        </Card>
      )}

      {!loading && invitations.map((inv) => {
        const form = formStates[inv.argumentUri];
        if (!form) return null;
        const isSubmitting = submitting === inv.argumentUri;

        return (
          <Card key={inv.argumentUri}>
            <CardContent className="pt-6 space-y-5">
              {/* Argument preview */}
              <div
                className="p-4 bg-muted rounded-md"
                style={{ borderLeft: `4px solid ${inv.argument.type === 'PRO' ? '#4caf50' : '#ef5350'}` }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <ProContraBadge type={inv.argument.type?.toLowerCase()} variant="soft" />
                  <span className="text-xs text-muted-foreground">
                    Ballot: {inv.argument.ballotRkey}
                  </span>
                </div>
                <h3 className="m-0 mb-2 font-medium">{inv.argument.title}</h3>
                <p className="m-0 text-sm text-muted-foreground leading-relaxed">{inv.argument.body}</p>
              </div>

              {/* Criteria sliders */}
              <div>
                <h4 className="text-sm font-medium mb-3">Criteria Assessment</h4>
                {form.criteria.map((criterion) => (
                  <div key={criterion.key} className="mb-4">
                    <div className="flex justify-between mb-2">
                      <label className="text-xs text-muted-foreground">{criterion.label}</label>
                      <span className="text-xs font-semibold">{criterion.rating}/5</span>
                    </div>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[criterion.rating]}
                      onValueChange={([val]) => updateCriterionRating(inv.argumentUri, criterion.key, val)}
                    />
                  </div>
                ))}
              </div>

              {/* Vote toggle */}
              <div>
                <h4 className="text-sm font-medium mb-2">Decision</h4>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant={form.vote === 'APPROVE' ? 'default' : 'outline'}
                    className={`flex-1 ${form.vote === 'APPROVE' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    onClick={() => updateVote(inv.argumentUri, 'APPROVE')}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant={form.vote === 'REJECT' ? 'default' : 'outline'}
                    className={`flex-1 ${form.vote === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                    onClick={() => updateVote(inv.argumentUri, 'REJECT')}
                  >
                    Reject
                  </Button>
                </div>
              </div>

              {/* Justification */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Justification {form.vote === 'REJECT' ? '(required)' : '(optional)'}
                </label>
                <Textarea
                  value={form.justification}
                  onChange={(e) => updateJustification(inv.argumentUri, e.target.value)}
                  placeholder="Explain your decision..."
                  rows={3}
                />
              </div>

              {/* Submit */}
              <Button
                className="w-full"
                onClick={() => handleSubmit(inv.argumentUri)}
                disabled={!form.vote || isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
