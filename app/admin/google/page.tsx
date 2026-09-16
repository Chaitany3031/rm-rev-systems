import { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getGoogleConnectionForTenant } from "@/domains/google";
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

  // Resolve tenant for administrative view
  const tenant = await prisma.tenant.findFirst({
    where: tenantId
      ? { id: tenantId }
      : { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  if (!tenant) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 border rounded-lg bg-card text-card-foreground shadow-sm text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Business Not Found</h1>
          <p className="text-sm text-muted-foreground">
            The requested business tenant could not be found. Please verify the identifier or slug.
          </p>
        </div>
      </main>
    );
  }

  const connection = await getGoogleConnectionForTenant(tenant.id);

  return (
    <main className="min-h-screen bg-background py-10 px-4 sm:px-6 lg:px-8 flex flex-col justify-start">
      <GoogleConnectionClient
        tenant={tenant}
        initialConnection={connection}
        initialError={params.error}
        initialStatus={params.status}
      />
    </main>
  );
}
