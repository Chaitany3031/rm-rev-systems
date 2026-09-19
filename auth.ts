import NextAuth from "next-auth";
import type { AuthOptions, DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { getServerSession } from "next-auth/next";
import { z } from "zod";

import { getEnvConfig } from "@/lib/env";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
  }
}

const devCredentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function getAuthSecret(): string {
  const env = getEnvConfig();
  const secret = env.AUTH_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is required and must be at least 32 characters long.");
  }

  return secret;
}

async function ensurePersistedUser(email: string, name?: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  const resolvedName = name?.trim() || normalizedEmail;

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      name: resolvedName,
    },
    create: {
      email: normalizedEmail,
      name: resolvedName,
    },
    select: { id: true, email: true, name: true },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email,
  };
}

async function ensureDevelopmentAdminUser(email: string) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "rm-solution" },
    update: {},
    create: {
      name: "RM Solution",
      slug: "rm-solution",
      publicToken: "rm-solution-dev",
      description: "Development tenant for local admin access.",
    },
  });

  const user = await ensurePersistedUser(email, "Development Administrator");

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id,
      },
    },
    update: { role: "ADMIN" },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: "ADMIN",
    },
  });

  return user;
}

function buildProviders() {
  const env = getEnvConfig();
  const providers: AuthOptions["providers"] = [];

  const hasGoogleConfig = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const isProduction = env.NODE_ENV === "production";
  const devCredentialsEnabled = env.AUTH_ENABLE_DEV_CREDENTIALS;

  if (hasGoogleConfig && (env.AUTH_PROVIDER === "google" || isProduction)) {
    providers.push(
      Google({
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        allowDangerousEmailAccountLinking: true,
      })
    );
  }

  if (devCredentialsEnabled) {
    if (isProduction) {
      throw new Error("Development credentials are disabled in production.");
    }

    const devEmail = env.DEV_AUTH_EMAIL?.trim().toLowerCase();
    const devPassword = env.DEV_AUTH_PASSWORD;
    if (!devEmail || !devPassword) {
      throw new Error("DEV_AUTH_EMAIL and DEV_AUTH_PASSWORD are required when AUTH_ENABLE_DEV_CREDENTIALS is enabled.");
    }

    providers.push(
      Credentials({
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "email", placeholder: "admin@example.com" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const parsed = devCredentialsSchema.safeParse(credentials);
          if (!parsed.success) {
            return null;
          }

          if (parsed.data.email.toLowerCase() !== devEmail || parsed.data.password !== devPassword) {
            return null;
          }

          return ensureDevelopmentAdminUser(devEmail);
        },
      })
    );
  }

  if (!providers.length && isProduction) {
    throw new Error("Production authentication is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET or configure an approved production provider.");
  }

  return providers;
}

export const authOptions: AuthOptions = {
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: buildProviders(),
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = user?.email?.trim().toLowerCase();
      if (!email) {
        return false;
      }

      const persistedUser = await ensurePersistedUser(email, user.name ?? profile?.name ?? email);
      if (user) {
        user.id = persistedUser.id;
      }

      if (account?.provider === "google") {
        return true;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

export async function auth() {
  return getServerSession(authOptions);
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
export default authOptions;
