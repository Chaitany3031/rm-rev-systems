"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GoogleConnectionPublicInfo } from "@/domains/google";
import {
  initiateGoogleConnectAction,
  disconnectGoogleAction,
} from "./actions";

interface GoogleConnectionClientProps {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  initialConnection: GoogleConnectionPublicInfo | null;
  initialError?: string | null;
  initialStatus?: string | null;
}

export function GoogleConnectionClient({
  tenant,
  initialConnection,
  initialError,
  initialStatus,
}: GoogleConnectionClientProps) {
  const [connection, setConnection] = useState<GoogleConnectionPublicInfo | null>(
    initialConnection
  );
  const [error, setError] = useState<string | null>(initialError || null);
  const [successMessage, setSuccessMessage] = useState<string | null>(
    initialStatus === "connected" ? "Google Business Profile successfully connected!" : null
  );
  const [isPending, startTransition] = useTransition();

  const isConnected = connection?.status === "CONNECTED";
  const isDisconnected = connection?.status === "DISCONNECTED";

  const handleConnect = () => {
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const res = await initiateGoogleConnectAction(tenant.id);
      if (res.success && res.data.authorizationUrl) {
        // Redirect browser to Google's official OAuth consent screen
        window.location.href = res.data.authorizationUrl;
      } else {
        const message = res.errors?.form?.[0] || res.message || "Failed to initiate Google connection.";
        setError(message);
      }
    });
  };

  const handleDisconnect = () => {
    if (!confirm("Are you sure you want to disconnect this Google Business Profile?")) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const res = await disconnectGoogleAction(tenant.id);
      if (res.success) {
        setConnection(res.data);
        setSuccessMessage("Google Business Profile successfully disconnected.");
      } else {
        const message = res.errors?.form?.[0] || res.message || "Failed to disconnect Google connection.";
        setError(message);
      }
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Google Business Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Connect your Google Business Profile account for <span className="font-semibold text-foreground">{tenant.name}</span> to enable location verification and review integrations.
        </p>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div
          role="status"
          className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-sm flex items-start justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Success:</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:opacity-80 text-xs font-semibold cursor-pointer"
            aria-label="Dismiss success message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 text-sm flex items-start justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Error:</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 dark:text-red-400 hover:opacity-80 text-xs font-semibold cursor-pointer"
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connection Card */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold">Integration Status</CardTitle>
              <CardDescription>
                Official Google Business Profile API OAuth 2.0 connection
              </CardDescription>
            </div>
            {isConnected ? (
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                Connected
              </Badge>
            ) : isDisconnected ? (
              <Badge variant="secondary" className="font-medium">
                Disconnected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground font-medium">
                Not Connected
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          {isConnected && connection ? (
            <div className="rounded-lg bg-muted/40 p-4 border space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                    Connected Business Location
                  </span>
                  <span className="font-semibold text-foreground text-base block mt-0.5">
                    {connection.locationTitle || tenant.name}
                  </span>
                  {connection.locationAddress && (
                    <span className="text-muted-foreground text-xs block mt-0.5">
                      {connection.locationAddress}
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                    Google Account
                  </span>
                  <span className="font-medium text-foreground block mt-0.5">
                    {connection.googleAccountName || "Google Account Authorized"}
                  </span>
                  {connection.googleAccountId && (
                    <span className="text-muted-foreground text-xs block font-mono">
                      {connection.googleAccountId}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground flex justify-between">
                <span>Location ID: {connection.googleLocationId || "Primary"}</span>
                <span>
                  Updated: {new Date(connection.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Connecting your Google Business Profile authorizes RM Rev Systems to interact securely with Google APIs on your behalf.
              </p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Server-side OAuth 2.0 authentication with official Google scopes.</li>
                <li>Your tokens are encrypted with AES-256-GCM and never exposed to the browser.</li>
                <li>You can disconnect or change locations at any time.</li>
              </ul>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t pt-4">
          <div className="text-xs text-muted-foreground">
            Provider: <span className="font-medium text-foreground">Official Google GBP API</span>
          </div>

          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Link href={`/admin/google/reviews?tenantId=${tenant.id}`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                  >
                    Reviews Inbox
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-800 cursor-pointer"
                >
                  {isPending ? "Disconnecting..." : "Disconnect"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleConnect}
                disabled={isPending}
                className="cursor-pointer"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    Connecting...
                  </span>
                ) : (
                  "Connect Google Business Profile"
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
