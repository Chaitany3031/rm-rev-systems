"use client";

import { useState, useCallback, useEffect } from "react";
import { triggerReviewSync, fetchTenantReviews } from "../reviews-actions";
import {
  generateReplyDraftAction,
  editReplyDraftAction,
  regenerateReplyDraftAction,
  fetchReplyDraftAction,
  approveReplyDraftAction,
} from "./reply-actions";
import type { GoogleReview } from "@prisma/client";

interface ReviewsInboxClientProps {
  tenantId: string;
  initialReviews: GoogleReview[];
  total: number;
  limit: number;
  offset: number;
}

interface SyncResult {
  processed: number;
  created: number;
  updated: number;
  completed: boolean;
  error?: string;
}

/**
 * Reply draft panel for a single Google review.
 * The `tenantId` prop is passed only to server actions for authentication;
 * it is never used as a trust boundary for authorization.
 */
interface ReplyDraftPanelProps {
  tenantId: string;
  review: GoogleReview;
  onDraftUpdated?: () => void;
  onApprovalUpdate?: () => void;
}

function ReplyDraftPanel({ tenantId, review, onDraftUpdated, onApprovalUpdate }: ReplyDraftPanelProps) {
  const [draft, setDraft] = useState<string>("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [approvedAt, setApprovedAt] = useState<Date | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch an existing draft (if any) when the panel mounts. All setState calls
  // run inside promise callbacks (not synchronously in the effect body), keeping
  // this compliant with react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    fetchReplyDraftAction(tenantId, review.id).then(
      (result) => {
        if (cancelled) return;
        if (result.success) {
          setDraft(result.data.content);
          setDraftId(result.data.id);
          setIsApproved(result.data.approved);
          setApprovedAt(result.data.approvedAt ? new Date(result.data.approvedAt) : null);
        } else {
          setDraft("");
          setDraftId(null);
          setIsApproved(false);
          setApprovedAt(null);
        }
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load draft");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [tenantId, review.id]);

  // Generate a new AI reply draft
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await generateReplyDraftAction(tenantId, review.id);
      if (result.success) {
        setDraft(result.data.content);
        setDraftId(result.data.id);
        setIsApproved(result.data.approved);
        setApprovedAt(result.data.approvedAt ? new Date(result.data.approvedAt) : null);
        setSuccessMessage("AI reply draft generated successfully.");
        onDraftUpdated?.();
      } else {
        setError(result.message || "Failed to generate draft");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft");
    } finally {
      setIsGenerating(false);
    }
  };

  // Regenerate the AI reply draft
  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await regenerateReplyDraftAction(tenantId, review.id);
      if (result.success) {
        setDraft(result.data.content);
        setDraftId(result.data.id);
        setIsApproved(result.data.approved);
        setApprovedAt(result.data.approvedAt ? new Date(result.data.approvedAt) : null);
        setSuccessMessage("AI reply draft regenerated successfully.");
        onDraftUpdated?.();
      } else {
        setError(result.message || "Failed to regenerate draft");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate draft");
    } finally {
      setIsRegenerating(false);
    }
  };

  // Save edited draft
  const handleSaveEdit = async () => {
    if (!draftId) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await editReplyDraftAction(tenantId, draftId, editContent);
      if (result.success) {
        setDraft(result.data.content);
        setIsApproved(result.data.approved);
        setApprovedAt(result.data.approvedAt ? new Date(result.data.approvedAt) : null);
        setSuccessMessage("Reply draft updated successfully.");
        onDraftUpdated?.();
      } else {
        setError(result.message || "Failed to update draft");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update draft");
    } finally {
      setIsSaving(false);
    }
  };

  // Approve the reply draft
  const handleApprove = async () => {
    if (!draftId) return;
    setIsApproving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await approveReplyDraftAction(tenantId, draftId);
      if (result.success) {
        setIsApproved(true);
        setApprovedAt(result.data.approvedAt ? new Date(result.data.approvedAt) : null);
        setSuccessMessage("Reply draft approved successfully.");
        onApprovalUpdate?.();
      } else {
        setError(result.message || "Failed to approve draft");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve draft");
    } finally {
      setIsApproving(false);
    }
  };

  // Start editing
  const startEditing = () => {
    setEditContent(draft);
    setIsEditing(true);
    setSuccessMessage(null);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
    setEditContent("");
    setError(null);
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="text-sm font-medium text-gray-900 mb-3">AI Reply Draft</h4>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-3 rounded-md bg-green-50 p-3">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {/* Draft content / editor */}
      <>
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                rows={6}
                placeholder="Edit your reply draft..."
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editContent.trim()}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="min-h-[60px] rounded-md border border-gray-200 bg-white p-3">
                {draft ? (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{draft}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No draft generated yet</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {!draft ? (
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || isRegenerating}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      "Generate AI Reply"
                    )}
                  </button>
                ) : !isApproved ? (
                  <>
                    <button
                      onClick={startEditing}
                      disabled={isEditing}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={isGenerating || isRegenerating}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isRegenerating ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Regenerating...
                        </>
                      ) : (
                        "Regenerate"
                      )}
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={isApproving || !draft.trim()}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      {isApproving ? "Approving..." : "Approve Draft"}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Approved
                    </span>
                    {approvedAt && (
                      <span className="text-xs text-gray-500 self-center">
                        {approvedAt.toLocaleString()}
                      </span>
                    )}
                    <button
                      onClick={startEditing}
                      disabled={isEditing}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={isGenerating || isRegenerating}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isRegenerating ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Regenerating...
                        </>
                      ) : (
                        "Regenerate"
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
    </div>
  );
}

export function ReviewsInboxClient({
  tenantId,
  initialReviews,
  total,
  limit,
  offset,
}: ReviewsInboxClientProps) {
  const [reviews, setReviews] = useState<GoogleReview[]>(initialReviews);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [currentOffset, setCurrentOffset] = useState(offset);
  const [currentTotal, setCurrentTotal] = useState(total);
  const [filterRating, setFilterRating] = useState<number | "all">("all");
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  // Fetch reviews with pagination
  const loadReviews = useCallback(
    async (newOffset: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchTenantReviews({
          tenantId,
          limit,
          offset: newOffset,
        });
        if (result.success) {
          setReviews(result.data.reviews);
          setCurrentTotal(result.data.total);
          setCurrentOffset(newOffset);
        } else {
          setError(result.message || "Failed to load reviews");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load reviews");
      } finally {
        setIsLoading(false);
      }
    },
    [tenantId, limit]
  );

  // Handle sync button click
  const handleSync = async () => {
    setIsSyncing(true);
    setError(null);
    setSyncResult(null);
    try {
      const result = await triggerReviewSync(tenantId);
      if (result.success) {
        setSyncResult(result.data);
        await loadReviews(0);
      } else {
        setError(result.message || "Sync failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle pagination
  const handleNextPage = () => {
    if (currentOffset + limit < currentTotal) {
      loadReviews(currentOffset + limit);
    }
  };

  const handlePrevPage = () => {
    if (currentOffset > 0) {
      loadReviews(currentOffset - limit);
    }
  };

  // Filter reviews by rating
  const filteredReviews = reviews.filter((review) => {
    if (filterRating === "all") return true;
    return review.starRating === filterRating;
  });

  // Helper to format date
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Helper to render star rating
  const renderStars = (rating: number | null | undefined) => {
    if (!rating) return "-";
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    return <span className="text-yellow-500">{stars}</span>;
  };

  // Find selected review
  const selectedReview = reviews.find((r) => r.id === selectedReviewId) || null;

  return (
    <div className="space-y-6">
      {/* Header with sync button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Google Reviews Inbox</h2>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSyncing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Syncing...
            </>
          ) : (
            <>
              <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync Reviews
            </>
          )}
        </button>
      </div>

      {/* Sync result notification */}
      {syncResult && (
        <div className={`rounded-md p-4 ${syncResult.error ? "bg-red-50" : "bg-green-50"}`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {syncResult.error ? (
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293 1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${syncResult.error ? "text-red-800" : "text-green-800"}`}>
                {syncResult.error ? "Sync failed" : "Sync completed successfully"}
              </h3>
              {syncResult.error ? (
                <div className="mt-2 text-sm text-red-700">
                  <p>{syncResult.error}</p>
                </div>
              ) : (
                <div className="mt-2 text-sm text-green-700">
                  <p>
                    Processed {syncResult.processed} reviews: {syncResult.created} new, {syncResult.updated} updated
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293 1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label htmlFor="rating-filter" className="text-sm font-medium text-gray-700">
          Filter by rating:
        </label>
        <select
          id="rating-filter"
          value={filterRating}
          onChange={(e) => setFilterRating(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="mt-1 block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
        >
          <option value="all">All ratings</option>
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
          <option value="2">2 stars</option>
          <option value="1">1 star</option>
        </select>
        <span className="text-sm text-gray-500">
          Showing {filteredReviews.length} of {currentTotal} reviews
        </span>
      </div>

      {/* Reviews table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reviewer
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comment
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  AI Reply
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <svg className="animate-spin mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="mt-2">Loading reviews...</p>
                  </td>
                </tr>
              ) : filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <p>No reviews found</p>
                  </td>
                </tr>
              ) : (
                filteredReviews.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {renderStars(review.starRating)}
                      <span className="ml-2 text-sm text-gray-600">
                        {review.starRating ? `${review.starRating}/5` : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {review.reviewerDisplayName || "Anonymous"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-md truncate">
                        {review.comment || <span className="text-gray-400 italic">No comment</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(review.reviewCreateTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {review.replyComment ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Responded
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedReviewId(selectedReviewId === review.id ? null : review.id)}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200"
                      >
                        {selectedReviewId === review.id ? "Close" : "AI Reply"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={handlePrevPage}
              disabled={currentOffset === 0 || isLoading}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={handleNextPage}
              disabled={currentOffset + limit >= currentTotal || isLoading}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{currentOffset + 1}</span> to{" "}
                <span className="font-medium">{Math.min(currentOffset + limit, currentTotal)}</span> of{" "}
                <span className="font-medium">{currentTotal}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={handlePrevPage}
                  disabled={currentOffset === 0 || isLoading}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentOffset + limit >= currentTotal || isLoading}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 001.414 0l-4 4a1 1 0 001.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* AI Reply Draft Panel */}
      {selectedReview && (
        <ReplyDraftPanel
          tenantId={tenantId}
          review={selectedReview}
          onDraftUpdated={() => {
            // Refresh reviews list if needed
          }}
        />
      )}
    </div>
  );
}