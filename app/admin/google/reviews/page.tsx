import { Metadata } from "next";
import { requireTenantAdmin } from "@/domains/auth";
import { getGoogleConnectionForTenant, getTenantReviews } from "@/domains/google";
import { AuthenticationError, ForbiddenError } from "@/lib/errors";
import { ReviewsInboxClient } from "./reviews-inbox-client";

export const metadata: Metadata = {
  title: "Google Reviews Inbox | Admin | RM Rev Systems",
  description: "View and manage Google Business Profile reviews.",
};

interface ReviewsPageProps {
  searchParams: Promise<{
    tenantId?: string;
    tenantSlug?: string;
  }>;
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const params = await searchParams;
  // Authenticate: validate tenant identifier and reject public feedback tokens
  const tenantIdentifier = params.tenantId || params.tenantSlug || "rm-solution";
  let authContext: Awaited<ReturnType<typeof requireTenantAdmin>>;
  try {
    authContext = await requireTenantAdmin(tenantIdentifier);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return <AdminAccessState title="Sign-in required" message="Please sign in to view business reviews." />;
    }

    if (error instanceof ForbiddenError) {
      return <AdminAccessState title="Access denied" message="You do not have administrator access to this business." />;
    }

    throw error;
  }

  // Resolve authenticated tenant (session-derived)
  const tenant = {
    id: authContext.tenantId,
    name: authContext.tenantName,
    slug: authContext.tenantSlug,
  };

  // Verify Google connection exists for authenticated tenant only
  const connection = await getGoogleConnectionForTenant(tenant.id);
  if (!connection) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 border rounded-lg bg-card text-card-foreground shadow-sm text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Google Not Connected</h1>
          <p className="text-sm text-muted-foreground">
            Please connect your Google Business Profile first to view reviews.
          </p>
        </div>
      </main>
    );
  }

  // Load initial reviews
  const { reviews, total } = await getTenantReviews({
    tenantId: tenant.id,
    limit: 20,
    offset: 0,
  });

  return (
    <main className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-start">
      <div className="max-w-6xl mx-auto w-full">
        <ReviewsInboxClient
          tenantId={tenant.id}
          initialReviews={reviews}
          total={total}
          limit={20}
          offset={0}
        />
      </div>
    </main>
  );
}

function AdminAccessState({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 border rounded-lg bg-card text-card-foreground shadow-sm text-center space-y-4">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}