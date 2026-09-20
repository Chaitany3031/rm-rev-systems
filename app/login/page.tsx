import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use your organization account to access the admin dashboard.
        </p>
        <div className="mt-6">
          <SignIn routing="hash" signUpUrl="/sign-up" forceRedirectUrl="/admin/google?tenantSlug=rm-solution" />
        </div>
      </div>
    </main>
  );
}
