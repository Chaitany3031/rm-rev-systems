import { z } from "zod";

export const syncReviewsSchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
});

export const getReviewsSchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
