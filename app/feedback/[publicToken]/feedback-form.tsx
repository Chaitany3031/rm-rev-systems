"use client";

import React, { useState, useTransition, useEffect } from "react";
import type { PublicServiceInfo } from "@/domains/services";
import { submitFeedbackAction, generateReviewDraftAction } from "./actions";
import { FEEDBACK_MAX_LENGTH } from "@/domains/feedback";
import { DRAFT_MAX_LENGTH } from "@/domains/reviews/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FeedbackFormProps {
  publicToken: string;
  tenantName: string;
  services: PublicServiceInfo[];
}

const RATING_LABELS: Record<number, { label: string; description: string }> = {
  1: { label: "1 star", description: "Very Dissatisfied" },
  2: { label: "2 stars", description: "Dissatisfied" },
  3: { label: "3 stars", description: "Neutral" },
  4: { label: "4 stars", description: "Satisfied" },
  5: { label: "5 stars", description: "Very Satisfied" },
};

export function FeedbackForm({ publicToken, tenantName, services }: FeedbackFormProps) {
  // Form submission state
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Post-submission review-draft state
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<string>("");
  const [isGeneratingDraft, startDraftTransition] = useTransition();
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Clear copied notification after 3 seconds
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  const toggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) => {
      const next = prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId];
      if (next.length > 0 && errors.serviceIds) {
        setErrors((e) => {
          const updated = { ...e };
          delete updated.serviceIds;
          return updated;
        });
      }
      return next;
    });
  };

  const selectRating = (value: number) => {
    setRating(value);
    if (errors.rating) {
      setErrors((e) => {
        const updated = { ...e };
        delete updated.rating;
        return updated;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side quick validation
    const clientErrors: Record<string, string[]> = {};
    if (selectedServiceIds.length === 0) {
      clientErrors.serviceIds = ["Please select at least one service you received."];
    }
    if (!rating) {
      clientErrors.rating = ["Please select an overall rating from 1 to 5 stars."];
    }
    if (feedbackText.length > FEEDBACK_MAX_LENGTH) {
      clientErrors.feedback = [
        `Feedback must not exceed ${FEEDBACK_MAX_LENGTH} characters.`,
      ];
    }

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setErrors({});

    startSubmitTransition(async () => {
      const res = await submitFeedbackAction({
        publicToken,
        rating: rating!,
        serviceIds: selectedServiceIds,
        feedback: feedbackText,
      });

      if (res.success) {
        setSubmissionId(res.data.submissionId);
        // Automatically start generating AI review draft
        triggerGenerateDraft(res.data.submissionId);
      } else {
        const errorMessage = res.message ?? "Failed to submit feedback.";
        setErrors(res.errors ?? { form: [errorMessage] });
      }
    });
  };

  const triggerGenerateDraft = (id: string) => {
    setDraftError(null);
    startDraftTransition(async () => {
      const res = await generateReviewDraftAction({
        publicToken,
        submissionId: id,
      });
      if (res.success) {
        setReviewDraft(res.data.draft);
      } else {
        const msg =
          res.message ?? "Unable to generate review draft at this time.";
        setDraftError(msg);
      }
    });
  };

  const handleCopyDraft = async () => {
    if (!reviewDraft) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(reviewDraft);
        setCopied(true);
      } else {
        // Fallback for older browsers
        const el = document.createElement("textarea");
        el.value = reviewDraft;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
      }
    } catch {
      setDraftError("Failed to copy text to clipboard. Please copy manually.");
    }
  };

  const handleReset = () => {
    setSelectedServiceIds([]);
    setRating(null);
    setHoveredRating(null);
    setFeedbackText("");
    setErrors({});
    setSubmissionId(null);
    setReviewDraft("");
    setDraftError(null);
    setCopied(false);
  };

  // POST-SUBMISSION STATE (Feature 02 Confirmation + Feature 03 AI Review Draft)
  if (submissionId) {
    return (
      <div className="space-y-6">
        {/* Success Header */}
        <Card className="border-primary/20 bg-card shadow-md">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              Thank You for Your Feedback!
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground mt-2">
              Your feedback for <span className="font-semibold text-foreground">{tenantName}</span> has been securely recorded.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Feature 03: AI Review Draft Assistant Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
                <span>AI-Assisted Review Draft</span>
                <Badge variant="secondary" className="text-xs font-normal">
                  Editable
                </Badge>
              </CardTitle>
            </div>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              We&apos;ve drafted a customer review based on your feedback. You can edit this text freely before copying it for your own use.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {/* Generating Loading State */}
            {isGeneratingDraft && (
              <div
                role="status"
                aria-live="polite"
                className="flex flex-col items-center justify-center p-8 space-y-3 bg-muted/40 rounded-lg border border-dashed border-border"
              >
                <svg
                  className="h-7 w-7 animate-spin text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-sm font-medium text-foreground">
                  Generating your review draft...
                </p>
                <p className="text-xs text-muted-foreground">
                  Summarizing your selected services and feedback
                </p>
              </div>
            )}

            {/* Error State with Retry */}
            {draftError && !isGeneratingDraft && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-3 text-destructive"
              >
                <div className="flex items-start gap-2">
                  <svg
                    className="h-5 w-5 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div className="flex-1 text-sm">
                    <p className="font-semibold">{draftError}</p>
                    <p className="text-xs mt-1 text-destructive/80">
                      Your original feedback is saved and safe. You can retry draft generation below.
                    </p>
                  </div>
                </div>
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => triggerGenerateDraft(submissionId)}
                    className="border-destructive/30 hover:bg-destructive/20 text-destructive cursor-pointer"
                  >
                    Retry Generating Draft
                  </Button>
                </div>
              </div>
            )}

            {/* Generated & Editable Draft Display */}
            {reviewDraft && !isGeneratingDraft && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="ai-review-draft"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Review Draft (Click to edit)
                  </Label>
                  <span
                    className={cn(
                      "text-xs",
                      reviewDraft.length > DRAFT_MAX_LENGTH
                        ? "text-destructive font-semibold"
                        : "text-muted-foreground"
                    )}
                    aria-live="polite"
                  >
                    {reviewDraft.length} / {DRAFT_MAX_LENGTH}
                  </span>
                </div>

                <div className="relative">
                  <Textarea
                    id="ai-review-draft"
                    value={reviewDraft}
                    onChange={(e) => setReviewDraft(e.target.value)}
                    rows={5}
                    maxLength={DRAFT_MAX_LENGTH + 100}
                    className="resize-y bg-background font-normal text-sm leading-relaxed border-border/80 focus-visible:ring-primary"
                    aria-label="Editable AI-generated review draft"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleCopyDraft}
                    className="w-full sm:w-auto min-w-[160px] h-10 font-medium cursor-pointer"
                  >
                    {copied ? (
                      <span className="flex items-center justify-center gap-1.5 text-emerald-100">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>Copied to Clipboard!</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                          />
                        </svg>
                        <span>Copy Review</span>
                      </span>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => triggerGenerateDraft(submissionId)}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Regenerate Draft
                  </Button>
                </div>

                {copied && (
                  <p
                    role="status"
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
                  >
                    ✓ Draft copied to clipboard. You can paste it into any public review platform of your choice.
                  </p>
                )}
              </div>
            )}

            {/* Reset Action */}
            <div className="pt-4 border-t border-border/40 text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Submit Another Response
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeRatingDisplay = hoveredRating ?? rating;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {/* Form-level error banner */}
      {errors.form && errors.form.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <div className="font-semibold">Unable to submit feedback</div>
          <ul className="mt-1 list-disc pl-5 space-y-1">
            {errors.form.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 1: Service Selection */}
      <div className="space-y-3">
        <div>
          <Label className="text-base font-semibold text-foreground block">
            1. Which service(s) did you receive?
            <span className="text-destructive ml-1" aria-hidden="true">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select one or more services from the list below.
          </p>
        </div>

        {errors.serviceIds && (
          <p id="services-error" role="alert" className="text-sm font-medium text-destructive">
            {errors.serviceIds[0]}
          </p>
        )}

        <div
          className="grid gap-3 sm:grid-cols-2"
          role="group"
          aria-labelledby="services-label"
          aria-describedby={errors.serviceIds ? "services-error" : undefined}
        >
          {services.map((service) => {
            const isSelected = selectedServiceIds.includes(service.id);
            return (
              <button
                key={service.id}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => toggleService(service.id)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs font-normal"
                    : "border-border bg-card hover:bg-muted/50"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 bg-background"
                  )}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-foreground flex items-center justify-between">
                    <span>{service.name}</span>
                    {isSelected && (
                      <Badge variant="secondary" className="ml-2 shrink-0 text-[10px] px-1.5 py-0">
                        Selected
                      </Badge>
                    )}
                  </div>
                  {service.description && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {service.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Overall 1-5 Rating */}
      <div className="space-y-3">
        <div>
          <Label className="text-base font-semibold text-foreground block">
            2. How would you rate your overall experience?
            <span className="text-destructive ml-1" aria-hidden="true">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select a rating from 1 to 5 stars.
          </p>
        </div>

        {errors.rating && (
          <p id="rating-error" role="alert" className="text-sm font-medium text-destructive">
            {errors.rating[0]}
          </p>
        )}

        <div className="space-y-2">
          <fieldset
            className="flex items-center gap-2 sm:gap-3"
            role="radiogroup"
            aria-label="Overall rating from 1 to 5 stars"
            aria-describedby={errors.rating ? "rating-error" : undefined}
          >
            {[1, 2, 3, 4, 5].map((starValue) => {
              const isSelected = rating === starValue;
              const isFilled = activeRatingDisplay !== null && starValue <= activeRatingDisplay;
              const meta = RATING_LABELS[starValue];

              return (
                <button
                  key={starValue}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${meta.label} - ${meta.description}`}
                  onClick={() => selectRating(starValue)}
                  onMouseEnter={() => setHoveredRating(starValue)}
                  onMouseLeave={() => setHoveredRating(null)}
                  onFocus={() => setHoveredRating(starValue)}
                  onBlur={() => setHoveredRating(null)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer",
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 bg-primary/5"
                      : "hover:bg-muted/60"
                  )}
                >
                  <svg
                    className={cn(
                      "h-8 w-8 sm:h-9 sm:w-9 transition-colors",
                      isFilled
                        ? "text-amber-500 fill-amber-500"
                        : "text-muted-foreground/30 fill-transparent hover:text-amber-400"
                    )}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                    />
                  </svg>
                  <span className="mt-1 text-xs font-medium text-foreground">{starValue}</span>
                </button>
              );
            })}
          </fieldset>

          {/* Accessible text indicator for selected rating */}
          {rating && (
            <div className="flex items-center gap-2 pt-1 text-sm font-medium text-foreground">
              <span>Rating:</span>
              <Badge variant="outline" className="border-primary/40 text-foreground font-semibold">
                {RATING_LABELS[rating].label} ({RATING_LABELS[rating].description})
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Optional Written Feedback */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="written-feedback" className="text-base font-semibold text-foreground">
            3. Detailed Feedback <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
          </Label>
          <span
            className={cn(
              "text-xs",
              feedbackText.length > FEEDBACK_MAX_LENGTH
                ? "text-destructive font-semibold"
                : "text-muted-foreground"
            )}
            aria-live="polite"
          >
            {feedbackText.length} / {FEEDBACK_MAX_LENGTH}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Tell us about what went well or how we can improve.
        </p>

        <Textarea
          id="written-feedback"
          name="feedback"
          value={feedbackText}
          onChange={(e) => {
            setFeedbackText(e.target.value);
            if (errors.feedback) {
              setErrors((errs) => {
                const updated = { ...errs };
                delete updated.feedback;
                return updated;
              });
            }
          }}
          placeholder="Write your feedback here (optional)..."
          rows={4}
          maxLength={FEEDBACK_MAX_LENGTH + 100}
          className={cn(
            "resize-y",
            errors.feedback && "border-destructive focus-visible:ring-destructive"
          )}
          aria-describedby={errors.feedback ? "feedback-error" : undefined}
        />

        {errors.feedback && (
          <p id="feedback-error" role="alert" className="text-sm font-medium text-destructive">
            {errors.feedback[0]}
          </p>
        )}
      </div>

      {/* Submit Action */}
      <div className="pt-4">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto min-w-[180px] h-11 text-base font-medium cursor-pointer"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-4 w-4 animate-spin text-current"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Submitting...</span>
            </span>
          ) : (
            "Submit Feedback"
          )}
        </Button>
      </div>
    </form>
  );
}