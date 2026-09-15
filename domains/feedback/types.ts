export interface SubmitFeedbackInput {
  publicToken: string;
  rating: number;
  serviceIds: string[];
  feedback?: string | null;
}

export interface FeedbackSubmissionResult {
  submissionId: string;
  createdAt: Date;
  tenantName: string;
}

export type FeedbackActionState =
  | { success: true; data: FeedbackSubmissionResult; errors?: never; message?: never }
  | { success: false; data?: never; errors: Record<string, string[]>; message?: string };
