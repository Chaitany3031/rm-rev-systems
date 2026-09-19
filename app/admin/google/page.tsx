import { Metadata } from "next";
import { requireTenantAdmin } from "@/domains/auth";
import { getGoogleConnectionForTenant } from "@/domains/google";
import { AuthenticationError, ForbiddenError } from "@/lib/errors";
import { GoogleConnectionClient } from "./google-connection-client";

export const metadata: Metadata = {
  title: "Google Business Profile Connection | Admin | RM Rev Systems",
  description: "Manage Google Business Profile OAuth connection and location configuration.",
};

interface AdminGooglePageProps {
  searchParams: Promise<{
    tenantId?: string;
    tenantSlug?: string;
    error?: string;
    status?: string;
  }>;
}

export default async function AdminGooglePage({ searchParams }: AdminGooglePageProps) {
  const params = await searchParams;
  const tenantId = params.tenantId;
  const tenantSlug = params.tenantSlug || "rm-solution";
  let admin: Awaited<ReturnType<typeof requireTenantAdmin>>;
  let connection: Awaited<ReturnType<typeof getGoogleConnectionForTenant>>;

  try {
    admin = await requireTenantAdmin(tenantId || tenantSlug);
    connection = await getGoogleConnectionForTenant(admin.tenantId);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return <AdminAccessState title="Sign-in required" message="Please sign in to manage this business connection." />;
    }

    if (error instanceof ForbiddenError) {
      return <AdminAccessState title="Access denied" message="You do not have administrator access to this business." />;
    }

    throw error;
  }

  return (
    <main className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-start">
      <GoogleConnectionClient
        tenant={{
          id: admin.tenantId,
          name: admin.tenantName,
          slug: admin.tenantSlug,
        }}
        initialConnection={connection}
        initialError={params.error}
        initialStatus={params.status}
      />
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
