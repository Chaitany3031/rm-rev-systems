import { z } from "zod";

export const initiateOAuthSchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  redirectPath: z.string().optional(),
});

export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1, "Authorization code is required").optional(),
  state: z.string().min(1, "OAuth state parameter is required"),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const selectLocationSchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
  googleAccountId: z.string().min(1, "googleAccountId is required"),
  googleAccountName: z.string().optional(),
  googleLocationId: z.string().min(1, "googleLocationId is required"),
  googleLocationName: z.string().optional(),
  locationTitle: z.string().min(1, "locationTitle is required").max(255),
  locationAddress: z.string().max(500).optional(),
});

export const disconnectSchema = z.object({
  tenantId: z.string().min(1, "tenantId is required"),
});
