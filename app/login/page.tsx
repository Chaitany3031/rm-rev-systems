"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid credentials. Please check your local development sign-in values.");
      return;
    }

    router.push("/admin/google?tenantSlug=rm-solution");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the local development admin account configured in your environment.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              placeholder="admin@example.com"
            />
          </label>

          <label className="block text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              placeholder="Enter password"
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <button type="submit" disabled={loading} className="mt-6 w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
