import React from "react";
import type { Metadata } from "next";
import { getTenantByPublicToken } from "@/domains/tenants";
import { getActiveServicesForTenant } from "@/domains/services";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FeedbackForm } from "./feedback-form";

interface PageProps {
  params: Promise<{
    publicToken: string;
  }>;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { publicToken } = await props.params;
  const tenant = await getTenantByPublicToken(publicToken);

  if (!tenant) {
    return {
      title: "Feedback Link Not Found | RM Review Systems",
      description: "The requested feedback link is invalid or unavailable.",
    };
  }

  return {
    title: `Customer Feedback — ${tenant.name}`,
    description: tenant.description ?? `Submit customer feedback for ${tenant.name}`,
  };
}

export default async function FeedbackPage(props: PageProps) {
  const { publicToken } = await props.params;

  // 1. Resolve tenant using opaque public token
  const tenant = await getTenantByPublicToken(publicToken);

  // 2. Safe not-found state if token is invalid or tenant does not exist
  if (!tenant) {
    return (
      <main className="min-h-screen bg-muted/30 px-4 py-12 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <Card className="border-border shadow-sm text-center">
            <CardHeader className="space-y-2 pb-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                Feedback Link Not Found
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                The feedback link you followed is invalid, inactive, or has expired.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Please verify that you have the correct URL or contact the business directly for assistance.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // 3. Load active services for resolved tenant
  const services = await getActiveServicesForTenant(tenant.id);

  // 4. Empty service state if tenant has no active services
  if (services.length === 0) {
    return (
      <main className="min-h-screen bg-muted/30 px-4 py-12 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="w-full max-w-lg">
          <Card className="border-border shadow-sm text-center">
            <CardHeader className="space-y-2 pb-4">
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                {tenant.name}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                No active services are currently available for feedback submission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Please check back later or contact {tenant.name} directly.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // 5. Render active customer feedback flow
  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Business Identity Header */}
        <header className="space-y-1.5 text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {tenant.name}
          </h1>
          {tenant.description && (
            <p className="text-sm text-muted-foreground">
              {tenant.description}
            </p>
          )}
          <p className="text-xs font-medium text-muted-foreground/80 pt-1">
            Customer Feedback Form
          </p>
        </header>

        {/* Feedback Form Card */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-4 border-b border-border/40">
            <CardTitle className="text-lg font-semibold text-foreground">
              Share Your Experience
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Help us understand how we served you. Your honest feedback is invaluable.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <FeedbackForm
              publicToken={publicToken}
              tenantName={tenant.name}
              services={services}
            />
          </CardContent>
        </Card>

        {/* Safe footer note */}
        <footer className="text-center text-xs text-muted-foreground/70 py-4">
          Powered by RM Review Systems • Authentic Customer Feedback
        </footer>
      </div>
    </main>
  );
}
