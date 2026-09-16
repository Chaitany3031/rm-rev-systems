import { getEnvConfig } from "@/lib/env";
import type { GoogleBusinessProfileProvider } from "./types";
import {
  HttpGoogleBusinessProfileProvider,
  MockGoogleBusinessProfileProvider,
  type MockProviderOptions,
} from "./business-profile/provider";

let cachedProvider: GoogleBusinessProfileProvider | null = null;

/**
 * Returns the configured GoogleBusinessProfileProvider.
 * In development and automated tests, defaults to MockGoogleBusinessProfileProvider.
 * In production or when GOOGLE_PROVIDER=google, uses HttpGoogleBusinessProfileProvider.
 */
export function getGoogleProvider(mockOptions?: MockProviderOptions): GoogleBusinessProfileProvider {
  if (mockOptions) {
    return new MockGoogleBusinessProfileProvider(mockOptions);
  }

  const env = getEnvConfig();
  if (env.GOOGLE_PROVIDER === "google") {
    if (!cachedProvider || !(cachedProvider instanceof HttpGoogleBusinessProfileProvider)) {
      cachedProvider = new HttpGoogleBusinessProfileProvider();
    }
    return cachedProvider;
  }

  if (!cachedProvider || !(cachedProvider instanceof MockGoogleBusinessProfileProvider)) {
    cachedProvider = new MockGoogleBusinessProfileProvider();
  }
  return cachedProvider;
}
